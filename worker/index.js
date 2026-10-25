import { ensureSchema } from './schema.js'
import { allReferencedKeys, deleteFile, difference, extractKeys, keysOfCategories, keysOfPosts, keysOfSetting, migrateToR2, removeUnused } from './files.js'
import { checkPassword, hashPassword, randomId, safeEqual, sign, verify } from './crypto.js'

const SESSION_COOKIE = 'od_session'
const VIEWER_COOKIE = 'od_viewer'
const SESSION_DAYS = 30
// boot: 첫 화면(로딩 화면)에 쓸 색·사이트 이름. 관리자 화면이 디자인에 맞춰 자동으로 저장해요.
const SETTING_KEYS = ['site', 'theme', 'home', 'boot']
// 카테고리 페이지 종류: posts(일반 게시판) · thread(타임라인 타래). 새 종류는 여기에 추가해요.
const PAGE_TYPES = ['posts', 'thread', 'pair', 'rp']
const MAX_SETTING_BYTES = 512 * 1024
const D1_FILE_LIMIT = 1_900_000
const R2_FILE_LIMIT = 25 * 1024 * 1024

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    try {
      if (url.pathname.startsWith('/api/')) {
        if (!env.DB) throw new HttpError(500, 'D1 데이터베이스(DB)가 연결되지 않았어요. wrangler.jsonc를 확인해주세요.')
        await ensureSchema(env.DB)
        // 예전에 D1에 넣어둔 파일이 남아 있으면 요청이 올 때마다 조금씩 R2로 옮겨요.
        if (env.BUCKET) ctx.waitUntil(migrateToR2(env).catch((err) => console.error('R2 이동 실패', err)))
        return await handleApi(request, env, ctx, url)
      }
      if (url.pathname.startsWith('/files/')) {
        return await serveFile(request, env, url)
      }
      return await servePage(request, env)
    } catch (err) {
      const status = err.status || 500
      if (status === 500) console.error(err)
      return json({ error: err.message || '서버 오류가 발생했어요.' }, status)
    }
  },
}

/* ------------------------------------------------------------------ */
/* 페이지(HTML): 로딩 화면이 처음부터 사이트 색으로 보이게                        */
/* ------------------------------------------------------------------ */

// 서버가 뜰 때마다 데이터베이스를 읽지 않게 1분 동안 기억해요.
let bootCache = { at: 0, value: null }
async function readBoot(env) {
  if (Date.now() - bootCache.at < 60_000) return bootCache.value
  let value = null
  try {
    await ensureSchema(env.DB)
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'boot'").first()
    value = parseJson(row?.value, null)
  } catch {
    value = null
  }
  bootCache = { at: Date.now(), value }
  return value
}

const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i
function cleanBoot(b) {
  if (!b || typeof b !== 'object') return null
  const pal = (p) => {
    const out = {}
    for (const k of ['bg', 'accent', 'onAccent', 'text', 'textSub', 'surface']) if (COLOR_RE.test(String(p?.[k] || ''))) out[k] = p[k]
    return out
  }
  return {
    mode: ['auto', 'light', 'dark'].includes(b.mode) ? b.mode : 'auto',
    allowToggle: b.allowToggle !== false,
    light: pal(b.light),
    dark: pal(b.dark),
    title: typeof b.title === 'string' ? b.title.slice(0, 120) : '',
  }
}

async function servePage(request, env) {
  if (request.method !== 'GET' || !env.DB) return env.ASSETS.fetch(request)
  // 조건부 요청(304)을 받으면 예전 색이 담긴 HTML이 그대로 쓰여서, 늘 새로 받아요.
  const headers = new Headers(request.headers)
  headers.delete('if-none-match')
  headers.delete('if-modified-since')
  const res = await env.ASSETS.fetch(new Request(request.url, { method: 'GET', headers }))
  if (!(res.headers.get('content-type') || '').includes('text/html')) return res
  const boot = cleanBoot(await readBoot(env))
  if (!boot) return res
  const json = JSON.stringify(boot).replace(/</g, '\\u003c')
  const out = new HTMLRewriter()
    .on('head', { element: (el) => el.prepend(`<script>window.__OD_BOOT=${json}</script>`, { html: true }) })
    .on('title', { element: (el) => boot.title && el.setInnerContent(boot.title) })
    .transform(res)
  const h = new Headers(out.headers)
  h.delete('etag')
  h.delete('last-modified')
  h.set('cache-control', 'no-cache')
  return new Response(out.body, { status: out.status, headers: h })
}

/* ------------------------------------------------------------------ */
/* 공통 유틸                                                            */
/* ------------------------------------------------------------------ */

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  })
}

async function readJson(request) {
  try {
    return await request.json()
  } catch {
    throw new HttpError(400, '요청 형식이 올바르지 않아요.')
  }
}

function nowIso() {
  return new Date().toISOString()
}

function parseJson(text, fallback) {
  try {
    return text ? JSON.parse(text) : fallback
  } catch {
    return fallback
  }
}

function clampStr(value, max) {
  return String(value ?? '').slice(0, max)
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    // 루비의 작은 글(rt)은 요약·검색에서 빼고, 글자 꾸밈 태그는 띄어쓰기 없이 지워요. (<b>굵</b>게 → 굵게)
    .replace(/<(rt|rp)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/?(b|i|u|s|em|strong|span|ruby|mark|small|sub|sup|del|ins|code|a|font)\b[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
}

// 대표 이미지는 본문 첫 사진으로 정하되, 스포일러로 가린 사진은 건너뛰어요. (목록에서 미리 보이지 않게)
function firstImage(html) {
  for (const tag of String(html || '').match(/<img\b[^>]*>/gi) || []) {
    if (/class=["'][^"']*\bspoiler-img\b/i.test(tag)) continue
    const m = tag.match(/src=["']([^"']+)["']/i)
    if (m) return m[1]
  }
  return null
}

function slugify(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9가-힣ㄱ-ㅎㅏ-ㅣ_-]/g, '')
    .slice(0, 40) || `c-${randomId(3)}`
}

/* ------------------------------------------------------------------ */
/* 로그인 세션                                                          */
/* ------------------------------------------------------------------ */

function sessionSecret(env) {
  return env.SESSION_SECRET || `${env.ADMIN_PASSWORD || ''}::our-diary-session`
}

function readCookie(request, name) {
  const header = request.headers.get('cookie') || ''
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return v.join('=')
  }
  return null
}

async function isAdmin(request, env) {
  if (!env.ADMIN_PASSWORD) return false
  const token = readCookie(request, SESSION_COOKIE)
  if (!token) return false
  const [exp, sig] = token.split('.')
  if (!exp || !sig || Number(exp) < Date.now()) return false
  return verify(sessionSecret(env), `admin:${exp}`, sig)
}

function sessionCookie(value, maxAge) {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
}

/* ------------------------------------------------------------------ */
/* 조회수                                                              */
/* ------------------------------------------------------------------ */

// 방문자를 알아보는 표시 두 가지: 브라우저 쿠키, 그리고 IP+브라우저 정보를 암호화한 값(IP 원본은 저장하지 않아요).
// 둘 중 하나라도 이 글을 본 적이 있으면 같은 사람으로 봐요. (쿠키를 지우거나 와이파이가 바뀌어도 한 번만 세게)
async function viewerKeys(request, env) {
  let vid = readCookie(request, VIEWER_COOKIE)
  let setCookie = null
  if (!vid || !/^[\w-]{8,40}$/.test(vid)) {
    vid = randomId(12)
    setCookie = `${VIEWER_COOKIE}=${vid}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${365 * 86400}`
  }
  const keys = [`c:${vid}`]
  const ip = request.headers.get('cf-connecting-ip')
  if (ip) keys.push(`n:${(await sign(sessionSecret(env), `viewer:${ip}:${request.headers.get('user-agent') || ''}`)).slice(0, 24)}`)
  return { keys, setCookie }
}

// 처음 보는 사람일 때만 조회수를 1 올려요. 관리자는 세지 않고, 본 기록만 남겨서
// 같은 브라우저로 로그아웃한 채 다시 봐도 세지 않게 해요.
async function recordView(db, postId, keys, count) {
  const seen = await db
    .prepare(`SELECT 1 FROM post_views WHERE post_id = ? AND viewer IN (${keys.map(() => '?').join(', ')}) LIMIT 1`)
    .bind(postId, ...keys)
    .first()
  const now = nowIso()
  const stmts = keys.map((k) => db.prepare('INSERT OR IGNORE INTO post_views (post_id, viewer, created_at) VALUES (?, ?, ?)').bind(postId, k, now))
  if (!seen && count) stmts.push(db.prepare('UPDATE posts SET views = views + 1 WHERE id = ?').bind(postId))
  await db.batch(stmts)
}

const loginFailures = new Map()

function tooManyFailures(ip) {
  const rec = loginFailures.get(ip)
  if (!rec) return false
  if (Date.now() - rec.first > 10 * 60 * 1000) {
    loginFailures.delete(ip)
    return false
  }
  return rec.count >= 8
}

function recordFailure(ip) {
  const rec = loginFailures.get(ip)
  if (!rec || Date.now() - rec.first > 10 * 60 * 1000) loginFailures.set(ip, { first: Date.now(), count: 1 })
  else rec.count += 1
}

/* ------------------------------------------------------------------ */
/* 라우터                                                               */
/* ------------------------------------------------------------------ */

async function handleApi(request, env, ctx, url) {
  const method = request.method
  const path = url.pathname.replace(/^\/api/, '').replace(/\/+$/, '') || '/'

  // 다른 사이트에서 몰래 보내는 요청(CSRF)을 막습니다.
  if (method !== 'GET' && method !== 'HEAD') {
    const origin = request.headers.get('origin')
    if (origin && new URL(origin).host !== url.host) throw new HttpError(403, '허용되지 않은 요청이에요.')
  }

  const admin = await isAdmin(request, env)
  const requireAdmin = () => {
    if (!admin) throw new HttpError(401, '로그인이 필요해요.')
  }
  const db = env.DB
  let m

  if (path === '/bootstrap' && method === 'GET') return json(await bootstrap(db, admin))

  if (path === '/login' && method === 'POST') {
    if (!env.ADMIN_PASSWORD) throw new HttpError(500, 'ADMIN_PASSWORD 비밀값이 아직 설정되지 않았어요. README의 배포 방법을 확인해주세요.')
    const ip = request.headers.get('cf-connecting-ip') || 'local'
    if (tooManyFailures(ip)) throw new HttpError(429, '로그인 시도가 너무 많아요. 10분 뒤에 다시 시도해주세요.')
    const { password } = await readJson(request)
    if (!(await safeEqual(password || '', env.ADMIN_PASSWORD))) {
      recordFailure(ip)
      throw new HttpError(401, '비밀번호가 맞지 않아요.')
    }
    loginFailures.delete(ip)
    const exp = Date.now() + SESSION_DAYS * 86400 * 1000
    const sig = await sign(sessionSecret(env), `admin:${exp}`)
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie(`${exp}.${sig}`, SESSION_DAYS * 86400) })
  }

  if (path === '/logout' && method === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) })
  }

  if ((m = path.match(/^\/settings\/(\w+)$/)) && method === 'PUT') {
    requireAdmin()
    const key = m[1]
    if (!SETTING_KEYS.includes(key)) throw new HttpError(400, '알 수 없는 설정이에요.')
    const text = await request.text()
    if (text.length > MAX_SETTING_BYTES) throw new HttpError(413, '설정 내용이 너무 커요.')
    if (parseJson(text, undefined) === undefined) throw new HttpError(400, '설정 형식이 올바르지 않아요.')
    const beforeKeys = await keysOfSetting(db, key)
    await db
      .prepare('INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = ?3')
      .bind(key, text, nowIso())
      .run()
    if (key === 'boot') bootCache = { at: 0, value: null }
    // 설정에서 빠진 사진(프로필·배너 교체 등)은 다른 곳에서 안 쓰면 지워요.
    ctx.waitUntil(removeUnused(env, difference(beforeKeys, extractKeys(text))))
    return json({ ok: true })
  }

  if (path === '/categories' && method === 'PUT') {
    requireAdmin()
    const removedKeys = await saveCategories(db, await readJson(request))
    if (removedKeys.size) ctx.waitUntil(removeUnused(env, [...removedKeys]))
    return json({ categories: await listCategories(db, admin) })
  }

  // 특수 페이지(페어 소개 등)의 내용
  if ((m = path.match(/^\/categories\/(\d+)\/config$/))) {
    const id = Number(m[1])
    if (method === 'GET') {
      const row = await db.prepare('SELECT config, hidden FROM categories WHERE id = ?').bind(id).first()
      if (!row || (row.hidden && !admin)) throw new HttpError(404, '페이지를 찾을 수 없어요.')
      return json({ config: parseJson(row.config, {}) })
    }
    if (method === 'PUT') {
      requireAdmin()
      const text = await request.text()
      if (text.length > MAX_SETTING_BYTES) throw new HttpError(413, '페이지 내용이 너무 커요.')
      if (parseJson(text, undefined) === undefined) throw new HttpError(400, '페이지 내용 형식이 올바르지 않아요.')
      const before = await keysOfCategories(db, [id])
      const res = await db.prepare('UPDATE categories SET config = ? WHERE id = ?').bind(text, id).run()
      if (!res.meta.changes) throw new HttpError(404, '페이지를 찾을 수 없어요.')
      ctx.waitUntil(removeUnused(env, difference(before, extractKeys(text))))
      return json({ ok: true })
    }
  }

  if (path === '/posts' && method === 'GET') return json(await listPosts(db, admin, url.searchParams))
  if (path === '/posts' && method === 'POST') {
    requireAdmin()
    const id = await savePost(db, null, await readJson(request))
    return json({ id })
  }

  if ((m = path.match(/^\/posts\/(\d+)$/))) {
    const id = Number(m[1])
    if (method === 'GET') {
      const result = await getPost(db, id, admin, false)
      if (result.locked) return json(result)
      const viewer = await viewerKeys(request, env)
      ctx.waitUntil(recordView(db, id, viewer.keys, !admin).catch((err) => console.error('조회수 기록 실패', err)))
      return json(result, 200, viewer.setCookie ? { 'set-cookie': viewer.setCookie } : {})
    }
    if (method === 'PUT') {
      requireAdmin()
      const beforeKeys = await keysOfPosts(db, [id])
      await savePost(db, id, await readJson(request))
      // 글에서 지운 사진·파일은 다른 곳에서 안 쓰면 저장소에서도 지워요.
      const removed = difference(beforeKeys, await keysOfPosts(db, [id]))
      if (removed.length) ctx.waitUntil(removeUnused(env, removed))
      return json({ id })
    }
    if (method === 'DELETE') {
      requireAdmin()
      const beforeKeys = await keysOfPosts(db, [id])
      await db.batch([
        db.prepare('DELETE FROM comments WHERE post_id = ? OR post_id IN (SELECT id FROM posts WHERE thread_id = ?)').bind(id, id),
        db.prepare('DELETE FROM post_views WHERE post_id = ? OR post_id IN (SELECT id FROM posts WHERE thread_id = ?)').bind(id, id),
        db.prepare('DELETE FROM posts WHERE id = ? OR thread_id = ?').bind(id, id),
      ])
      const removed = await removeUnused(env, [...beforeKeys])
      return json({ ok: true, removedFiles: removed.length })
    }
  }

  if ((m = path.match(/^\/posts\/(\d+)\/unlock$/)) && method === 'POST') {
    const id = Number(m[1])
    const { password } = await readJson(request)
    const row = await db.prepare('SELECT password_hash FROM posts WHERE id = ? AND visibility = ?').bind(id, 'protected').first()
    if (!row || !(await checkPassword(password || '', row.password_hash))) throw new HttpError(403, '비밀번호가 맞지 않아요.')
    const viewer = await viewerKeys(request, env)
    ctx.waitUntil(recordView(db, id, viewer.keys, !admin).catch((err) => console.error('조회수 기록 실패', err)))
    return json(await getPost(db, id, admin, true), 200, viewer.setCookie ? { 'set-cookie': viewer.setCookie } : {})
  }

  if ((m = path.match(/^\/posts\/(\d+)\/react$/)) && method === 'POST') {
    const id = Number(m[1])
    const { emoji, undo } = await readJson(request)
    const key = clampStr(emoji, 32)
    if (!key) throw new HttpError(400, '반응을 골라주세요.')
    const row = await db.prepare("SELECT reactions FROM posts WHERE id = ? AND visibility != 'private'").bind(id).first()
    if (!row) throw new HttpError(404, '글을 찾을 수 없어요.')
    const reactions = parseJson(row.reactions, {})
    if (!(key in reactions) && Object.keys(reactions).length >= 30) throw new HttpError(400, '반응 종류가 너무 많아요.')
    reactions[key] = Math.max(0, (reactions[key] || 0) + (undo ? -1 : 1))
    if (reactions[key] === 0) delete reactions[key]
    await db.prepare('UPDATE posts SET reactions = ? WHERE id = ?').bind(JSON.stringify(reactions), id).run()
    return json({ reactions })
  }

  if (path === '/tags' && method === 'GET') return json({ tags: await listTags(db, admin) })

  if (path === '/calendar' && method === 'GET') {
    const month = url.searchParams.get('month') || ''
    if (!/^\d{4}-\d{2}$/.test(month)) throw new HttpError(400, 'month=YYYY-MM 형식으로 요청해주세요.')
    const { results } = await db
      .prepare(`SELECT id, title, visibility, substr(published_at, 1, 10) AS date FROM posts
        WHERE type = 'post' AND substr(published_at, 1, 7) = ? ${admin ? '' : "AND visibility != 'private'"}
        ORDER BY published_at`)
      .bind(month)
      .all()
    return json({ days: results })
  }

  if (path === '/comments' && method === 'GET') return json(await listComments(db, admin, url.searchParams))
  if (path === '/comments' && method === 'POST') return json(await addComment(db, admin, await readJson(request)))
  if ((m = path.match(/^\/comments\/(\d+)$/)) && method === 'DELETE') {
    const id = Number(m[1])
    const body = await readJson(request).catch(() => ({}))
    const row = await db.prepare('SELECT password_hash FROM comments WHERE id = ?').bind(id).first()
    if (!row) throw new HttpError(404, '이미 삭제된 글이에요.')
    if (!admin && !(await checkPassword(body.password || '', row.password_hash))) throw new HttpError(403, '비밀번호가 맞지 않아요.')
    await db.prepare('DELETE FROM comments WHERE id = ?1 OR parent_id = ?1').bind(id).run()
    return json({ ok: true })
  }

  if (path === '/upload' && method === 'POST') {
    requireAdmin()
    return json(await uploadFile(request, env))
  }

  if (path === '/files' && method === 'GET') {
    requireAdmin()
    const [list, used, totals] = await Promise.all([
      db.prepare('SELECT key, mime, size, created_at, data IS NOT NULL AS in_d1 FROM files ORDER BY created_at DESC LIMIT 300').all(),
      allReferencedKeys(db),
      db.prepare('SELECT COUNT(*) AS count, COALESCE(SUM(size), 0) AS bytes, COALESCE(SUM(data IS NOT NULL), 0) AS in_d1 FROM files').first(),
    ])
    return json({
      storage: { r2: !!env.BUCKET, count: totals.count, bytes: totals.bytes, pendingD1: totals.in_d1 },
      files: list.results.map((f) => ({ key: f.key, mime: f.mime, size: f.size, created_at: f.created_at, inD1: !!f.in_d1, used: used.has(f.key), url: `/files/${f.key}` })),
    })
  }

  if ((m = path.match(/^\/files\/(.+)$/)) && method === 'DELETE') {
    requireAdmin()
    await deleteFile(env, decodeURIComponent(m[1]))
    return json({ ok: true })
  }

  // 어디에도 쓰이지 않는 파일 한꺼번에 지우기 (방금 올리고 아직 저장 안 한 글의 사진은 건드리지 않게 시간 여유를 둬요)
  if (path === '/files-cleanup' && method === 'POST') {
    requireAdmin()
    const { hours = 24 } = await readJson(request).catch(() => ({}))
    const cutoff = new Date(Date.now() - Math.max(0, Number(hours) || 0) * 3600 * 1000).toISOString()
    const [{ results }, used] = await Promise.all([db.prepare('SELECT key FROM files WHERE created_at < ?').bind(cutoff).all(), allReferencedKeys(db)])
    const targets = results.map((r) => r.key).filter((k) => !used.has(k))
    for (const key of targets) await deleteFile(env, key)
    return json({ removed: targets.length })
  }

  if (path === '/files-migrate' && method === 'POST') {
    requireAdmin()
    if (!env.BUCKET) throw new HttpError(400, 'R2 저장소(BUCKET)가 연결되지 않았어요.')
    return json(await migrateToR2(env, 10, true))
  }

  if (path === '/export' && method === 'GET') {
    requireAdmin()
    return json(await exportAll(db), 200, { 'content-disposition': `attachment; filename="our-diary-backup-${nowIso().slice(0, 10)}.json"` })
  }
  if (path === '/import' && method === 'POST') {
    requireAdmin()
    await importAll(db, await readJson(request))
    return json({ ok: true })
  }

  throw new HttpError(404, '찾을 수 없는 주소예요.')
}

/* ------------------------------------------------------------------ */
/* 설정 · 카테고리                                                      */
/* ------------------------------------------------------------------ */

async function readSettings(db) {
  const { results } = await db.prepare('SELECT key, value FROM settings').all()
  const out = {}
  // '__'로 시작하는 건 서버가 쓰는 내부 값(표 구조 버전 등)이라 빼요.
  for (const row of results) if (!row.key.startsWith('__')) out[row.key] = parseJson(row.value, null)
  return out
}

async function bootstrap(db, admin) {
  const [settings, categories, totals] = await Promise.all([
    readSettings(db),
    listCategories(db, admin),
    db.prepare(`SELECT COUNT(*) AS posts FROM posts WHERE type = 'post' ${admin ? '' : "AND visibility != 'private'"}`).first(),
  ])
  return {
    site: settings.site || null,
    theme: settings.theme || null,
    home: settings.home || null,
    boot: settings.boot || null,
    categories,
    stats: { posts: totals?.posts || 0 },
    admin,
  }
}

async function listCategories(db, admin) {
  const { results } = await db
    .prepare(`SELECT c.*, COUNT(p.id) AS count, MAX(p.published_at) AS latest
      FROM categories c
      LEFT JOIN posts p ON p.category_id = c.id AND p.type = 'post' ${admin ? '' : "AND p.visibility != 'private'"}
      ${admin ? '' : 'WHERE c.hidden = 0'}
      GROUP BY c.id
      ORDER BY c.sort_order, c.id`)
    .all()
  // 페이지 내용(config)은 클 수 있어서 목록에는 빼고, 그 페이지를 열 때 따로 불러와요.
  return results.map(({ config, ...c }) => ({ ...c, has_config: !!config }))
}

async function saveCategories(db, list) {
  if (!Array.isArray(list)) throw new HttpError(400, '카테고리 목록 형식이 올바르지 않아요.')
  const { results: existing } = await db.prepare('SELECT id, slug FROM categories').all()
  const existingIds = new Set(existing.map((c) => c.id))
  const keyToId = new Map()
  const usedSlugs = new Set()

  const uniqueSlug = (raw) => {
    let base = slugify(raw)
    let slug = base
    let n = 2
    while (usedSlugs.has(slug)) slug = `${base}-${n++}`
    usedSlugs.add(slug)
    return slug
  }

  // 슬러그 중복을 피하기 위해 먼저 전부 임시 값으로 바꿉니다.
  const prepared = list.slice(0, 200).map((c, i) => ({
    key: String(c.key ?? c.id),
    id: existingIds.has(Number(c.id)) ? Number(c.id) : null,
    name: clampStr(c.name, 40) || '새 카테고리',
    slug: uniqueSlug(c.slug || c.name),
    icon: clampStr(c.icon, 60),
    description: clampStr(c.description, 200),
    list_style: ['list', 'group', 'card', 'magazine', 'gallery', 'masonry', 'album', 'memo', 'timeline'].includes(c.list_style) ? c.list_style : null,
    page_type: PAGE_TYPES.includes(c.page_type) ? c.page_type : 'posts',
    parentKey: c.parentKey != null ? String(c.parentKey) : c.parent_id != null ? String(c.parent_id) : null,
    sort_order: i,
    hidden: c.hidden ? 1 : 0,
  }))

  const keepIds = prepared.filter((c) => c.id).map((c) => c.id)
  const removed = existing.filter((c) => !keepIds.includes(c.id)).map((c) => c.id)
  const removedKeys = await keysOfCategories(db, removed)
  const stmts = []
  for (const id of removed) {
    stmts.push(db.prepare('DELETE FROM categories WHERE id = ?').bind(id))
    stmts.push(db.prepare('UPDATE posts SET category_id = NULL WHERE category_id = ?').bind(id))
  }
  for (const c of prepared.filter((c) => c.id)) {
    stmts.push(db.prepare('UPDATE categories SET slug = ? WHERE id = ?').bind(`tmp-${c.id}-${randomId(4)}`, c.id))
  }
  if (stmts.length) await db.batch(stmts)

  for (const c of prepared) {
    if (!c.id) {
      const res = await db
        .prepare('INSERT INTO categories (name, slug, sort_order) VALUES (?, ?, ?)')
        .bind(c.name, `tmp-new-${randomId(5)}`, c.sort_order)
        .run()
      c.id = res.meta.last_row_id
    }
    keyToId.set(c.key, c.id)
  }

  await db.batch(
    prepared.map((c) => {
      const parentId = c.parentKey && keyToId.has(c.parentKey) && keyToId.get(c.parentKey) !== c.id ? keyToId.get(c.parentKey) : null
      return db
        .prepare('UPDATE categories SET name = ?, slug = ?, icon = ?, description = ?, list_style = ?, page_type = ?, parent_id = ?, sort_order = ?, hidden = ? WHERE id = ?')
        .bind(c.name, c.slug, c.icon, c.description, c.list_style, c.page_type, parentId, c.sort_order, c.hidden, c.id)
    }),
  )
  return removedKeys
}

/* ------------------------------------------------------------------ */
/* 글                                                                  */
/* ------------------------------------------------------------------ */

const LIST_COLUMNS = `p.id, p.type, p.title, p.excerpt, p.thumbnail, p.category_id, p.tags, p.visibility, p.pinned,
  p.views, p.reactions, p.extra, p.published_at, p.updated_at,
  (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
  (SELECT COUNT(*) FROM posts r WHERE r.thread_id = p.id) AS reply_count`

function shapeListItem(row, admin) {
  const locked = row.visibility === 'protected' && !admin
  const extra = parseJson(row.extra, {})
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    excerpt: locked ? '' : row.excerpt,
    thumbnail: locked ? null : row.thumbnail,
    categoryId: row.category_id,
    tags: parseJson(row.tags, []),
    visibility: row.visibility,
    locked,
    pinned: !!row.pinned,
    views: row.views,
    reactions: parseJson(row.reactions, {}),
    subtitle: extra.subtitle || '',
    hideExcerpt: !!extra.hideExcerpt,
    // 타임라인 보기에서 실제 날짜 대신 보여줄 세계관 날짜 (비우면 실제 날짜)
    tlGroup: extra.tlGroup || '',
    tlLabel: extra.tlLabel || '',
    // 역극 로그 페이지용 정보
    rpWorld: extra.rpWorld || '',
    rpDesc: locked ? '' : extra.rpDesc || '',
    rpPeriod: extra.rpPeriod || '',
    rpStatus: extra.rpStatus || '',
    rpQuote: !locked && extra.rpQuote?.text ? { char: String(extra.rpQuote.char || ''), text: String(extra.rpQuote.text).slice(0, 300) } : null,
    commentCount: row.comment_count || 0,
    replyCount: row.reply_count || 0,
    author: extra.author || 'me',
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  }
}

async function categoryIdsFor(db, slug) {
  const { results } = await db.prepare('SELECT id, slug, parent_id FROM categories').all()
  const root = results.find((c) => c.slug === slug)
  if (!root) return []
  const ids = [root.id]
  for (let i = 0; i < ids.length; i++) {
    for (const c of results) if (c.parent_id === ids[i] && !ids.includes(c.id)) ids.push(c.id)
  }
  return ids
}

async function listPosts(db, admin, params) {
  const where = []
  const binds = []
  const type = params.get('type') || 'post'
  if (type !== 'all') {
    where.push('p.type = ?')
    binds.push(type === 'notice' ? 'notice' : 'post')
  }
  if (!admin) where.push("p.visibility != 'private'")
  else if (params.get('visibility')) {
    where.push('p.visibility = ?')
    binds.push(params.get('visibility'))
  }

  const category = params.get('category')
  if (category) {
    const ids = await categoryIdsFor(db, category)
    if (!ids.length) return { items: [], total: 0, page: 1, pages: 1 }
    where.push(`p.category_id IN (${ids.map(() => '?').join(',')})`)
    binds.push(...ids)
  }
  const tag = params.get('tag')
  if (tag) {
    where.push('EXISTS (SELECT 1 FROM json_each(p.tags) WHERE json_each.value = ?)')
    binds.push(tag)
  }
  // 역극 로그: 세계선(본편·IF·AU 등)으로 나눠 보기 — 이 조건을 빼고 세계선별 개수도 세요
  const whereNoWorld = [...where]
  const bindsNoWorld = [...binds]
  const world = params.get('world')
  if (world) {
    where.push("COALESCE(json_extract(p.extra, '$.rpWorld'), '') = ?")
    binds.push(world)
  }
  const q = (params.get('q') || '').trim()
  if (q) {
    const vis = admin ? '1' : "p.visibility = 'public'"
    where.push(`(p.title LIKE ? OR p.tags LIKE ? OR (${vis} AND (p.plain LIKE ? OR json_extract(p.extra, '$.rpDesc') LIKE ?)))`)
    binds.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`)
  }
  const date = params.get('date')
  if (date && /^\d{4}-\d{2}(-\d{2})?$/.test(date)) {
    where.push('substr(p.published_at, 1, ?) = ?')
    binds.push(date.length, date)
  }
  const idsParam = params.get('ids')
  let ids = null
  if (idsParam) {
    ids = idsParam.split(',').map(Number).filter(Boolean).slice(0, 50)
    if (!ids.length) return { items: [], total: 0, page: 1, pages: 1 }
    where.push(`p.id IN (${ids.map(() => '?').join(',')})`)
    binds.push(...ids)
  }

  // limit=all: 한 페이지에 모든 글 (너무 많으면 1000개까지)
  const limit = params.get('limit') === 'all' ? 1000 : Math.min(Math.max(Number(params.get('limit')) || 12, 1), 60)
  const page = Math.max(Number(params.get('page')) || 1, 1)
  const sort = params.get('sort') || 'recent'
  // 고정 글은 최신순에서 늘 맨 앞에. 오래된 순이어도 pinned=1을 주면 맨 앞에 둬요. (역극 목록)
  const pinnedFirst = params.get('pinned') === '1' || (params.get('pinned') !== '0' && sort === 'recent')
  let order = 'p.published_at DESC, p.id DESC'
  if (sort === 'oldest') order = 'p.published_at ASC, p.id ASC'
  if (sort === 'views') order = 'p.views DESC, p.published_at DESC'
  if (pinnedFirst) order = `p.pinned DESC, ${order}`

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const [count, rows] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS n FROM posts p ${whereSql}`).bind(...binds).first(),
    db
      .prepare(`SELECT ${LIST_COLUMNS} FROM posts p ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`)
      .bind(...binds, limit, (page - 1) * limit)
      .all(),
  ])
  let items = rows.results.map((r) => shapeListItem(r, admin))
  // 타임라인 타래 페이지는 목록에서 본문까지 바로 보여줘요.
  if (params.get('full') === '1' && items.length) {
    const open = items.filter((it) => !it.locked).map((it) => it.id)
    if (open.length) {
      const { results } = await db.prepare(`SELECT id, content FROM posts WHERE id IN (${open.map(() => '?').join(',')})`).bind(...open).all()
      const byId = new Map(results.map((r) => [r.id, r.content]))
      items = items.map((it) => (byId.has(it.id) ? { ...it, content: byId.get(it.id) } : it))
    }
  }
  if (ids) items.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
  // 검색어가 본문 어디에 나오는지 앞뒤 문장을 조금 보여줘요.
  if (q && params.get('snippet') === '1' && items.length) {
    const open = items.filter((it) => !it.locked).map((it) => it.id)
    if (open.length) {
      const { results } = await db.prepare(`SELECT id, plain FROM posts WHERE id IN (${open.map(() => '?').join(',')})`).bind(...open).all()
      const lower = q.toLowerCase()
      const byId = new Map(
        results.map((r) => {
          const text = String(r.plain || '').replace(/\s+/g, ' ')
          const at = text.toLowerCase().indexOf(lower)
          if (at < 0) return [r.id, '']
          const start = Math.max(0, at - 50)
          const end = Math.min(text.length, at + q.length + 70)
          return [r.id, `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`]
        }),
      )
      items = items.map((it) => (byId.get(it.id) ? { ...it, snippet: byId.get(it.id) } : it))
    }
  }
  const total = count?.n || 0
  const result = { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) }
  if (params.get('worldCounts') === '1') {
    const sql = whereNoWorld.length ? `WHERE ${whereNoWorld.join(' AND ')}` : ''
    const { results } = await db
      .prepare(`SELECT COALESCE(json_extract(p.extra, '$.rpWorld'), '') AS w, COUNT(*) AS n FROM posts p ${sql} GROUP BY w`)
      .bind(...bindsNoWorld)
      .all()
    result.worldCounts = Object.fromEntries(results.map((r) => [r.w, r.n]))
  }
  return result
}

async function getPost(db, id, admin, unlocked) {
  const row = await db.prepare(`SELECT p.*, (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count FROM posts p WHERE p.id = ?`).bind(id).first()
  if (!row || (row.visibility === 'private' && !admin)) throw new HttpError(404, '글을 찾을 수 없어요.')
  // 타래에 달린 글은 맨 위 글(타래 시작 글)로 안내해요.
  if (row.type === 'reply') return { replyOf: row.thread_id, id: row.id }
  const base = shapeListItem(row, admin || unlocked)
  const extra = parseJson(row.extra, {})
  const post = {
    ...base,
    locked: row.visibility === 'protected' && !admin && !unlocked,
    allowComments: !!row.allow_comments,
    createdAt: row.created_at,
  }
  // 잠긴 글에는 비밀번호 힌트만 알려줘요.
  if (post.locked) post.extra = extra.hint ? { hint: String(extra.hint) } : {}
  if (!post.locked) {
    post.content = row.content
    post.format = row.format
    post.extra = extra
    const replies = await db
      .prepare('SELECT id, content, format, extra, reactions, published_at, updated_at FROM posts WHERE thread_id = ? ORDER BY published_at ASC, id ASC')
      .bind(id)
      .all()
    post.thread = replies.results.map((r) => {
      const ex = parseJson(r.extra, {})
      return { id: r.id, content: r.content, format: r.format, author: ex.author || 'me', extra: ex, publishedAt: r.published_at, updatedAt: r.updated_at }
    })
  } else {
    post.extra = { subtitle: extra.subtitle || '', hint: extra.hint || '' }
  }

  const vis = admin ? '' : "AND visibility != 'private'"
  // 이전 글·다음 글은 이 글과 같은 카테고리 안에서만 찾아요. 하위 카테고리 글이면 그 하위 카테고리 안에서만,
  // 상위 카테고리에 바로 넣은 글이면 그 상위 카테고리 글끼리, 카테고리가 없는 글은 카테고리 없는 글끼리.
  const sameCat = row.category_id ? 'AND category_id = ?' : 'AND category_id IS NULL'
  const catBind = row.category_id ? [row.category_id] : []
  const [prev, next, related] = await Promise.all([
    db
      .prepare(`SELECT id, title FROM posts WHERE type = ? ${sameCat} ${vis} AND (published_at < ? OR (published_at = ? AND id < ?)) ORDER BY published_at DESC, id DESC LIMIT 1`)
      .bind(row.type, ...catBind, row.published_at, row.published_at, id)
      .first(),
    db
      .prepare(`SELECT id, title FROM posts WHERE type = ? ${sameCat} ${vis} AND (published_at > ? OR (published_at = ? AND id > ?)) ORDER BY published_at ASC, id ASC LIMIT 1`)
      .bind(row.type, ...catBind, row.published_at, row.published_at, id)
      .first(),
    row.category_id
      ? db
          .prepare(`SELECT id, title, published_at, thumbnail, visibility FROM posts WHERE category_id = ? AND id != ? AND type = 'post' ${vis} ORDER BY published_at DESC LIMIT 5`)
          .bind(row.category_id, id)
          .all()
      : { results: [] },
  ])
  return {
    ...post,
    prev: prev || null,
    next: next || null,
    related: related.results.map((r) => ({
      id: r.id,
      title: r.title,
      publishedAt: r.published_at,
      thumbnail: r.visibility === 'protected' && !admin ? null : r.thumbnail,
      locked: r.visibility === 'protected' && !admin,
    })),
  }
}

async function savePost(db, id, body) {
  const content = String(body.content ?? '')
  if (content.length > 900_000) throw new HttpError(413, '글이 너무 길어요. 이미지는 붙여넣기 대신 업로드를 이용해주세요.')
  const visibility = ['public', 'protected', 'private'].includes(body.visibility) ? body.visibility : 'public'
  const plain = stripHtml(content)
  const excerpt = clampStr(body.excerpt?.trim() || plain.replace(/\n+/g, ' '), 180)
  const thumbnail = body.thumbnail ? clampStr(body.thumbnail, 2000) : firstImage(content)
  const tags = Array.isArray(body.tags)
    ? [...new Set(body.tags.map((t) => clampStr(String(t).replace(/^#/, '').trim(), 40)).filter(Boolean))].slice(0, 30)
    : []
  const publishedAt = /^\d{4}-\d{2}-\d{2}/.test(body.publishedAt || '') ? body.publishedAt : nowIso()
  const extra = body.extra && typeof body.extra === 'object' ? body.extra : {}
  if (body.author === 'me' || body.author === 'partner') extra.author = body.author

  // 타래에 이어 다는 글: 시작 글의 카테고리를 따르고, 공개 범위는 시작 글을 따라가요.
  const isReply = body.type === 'reply'
  let threadId = null
  let categoryId = body.categoryId ? Number(body.categoryId) : null
  if (isReply) {
    const root = await db.prepare("SELECT id, category_id FROM posts WHERE id = ? AND type = 'post'").bind(Number(body.threadId)).first()
    if (!root) throw new HttpError(404, '이어 달 타래를 찾을 수 없어요.')
    threadId = root.id
    categoryId = root.category_id
  }
  const title = clampStr(body.title?.trim() || plain.replace(/\s+/g, ' ').slice(0, 40) || '(사진)', 200)

  let passwordHash = null
  if (visibility === 'protected' && !isReply) {
    if (body.password) passwordHash = await hashPassword(body.password)
    else if (id) {
      const row = await db.prepare('SELECT password_hash FROM posts WHERE id = ?').bind(id).first()
      passwordHash = row?.password_hash || null
    }
    if (!passwordHash) throw new HttpError(400, '비밀글에는 비밀번호가 필요해요.')
  }

  const values = [
    isReply ? 'reply' : body.type === 'notice' ? 'notice' : 'post',
    title,
    content,
    body.format === 'html' ? 'html' : 'rich',
    excerpt,
    plain.slice(0, 200_000),
    thumbnail,
    categoryId,
    JSON.stringify(tags),
    isReply ? 'public' : visibility,
    passwordHash,
    body.pinned ? 1 : 0,
    body.allowComments === false ? 0 : 1,
    JSON.stringify(extra).slice(0, 20_000),
    threadId,
    publishedAt,
  ]

  if (id) {
    const res = await db
      .prepare(`UPDATE posts SET type = ?, title = ?, content = ?, format = ?, excerpt = ?, plain = ?, thumbnail = ?, category_id = ?,
        tags = ?, visibility = ?, password_hash = ?, pinned = ?, allow_comments = ?, extra = ?, thread_id = ?, published_at = ?, updated_at = ? WHERE id = ?`)
      .bind(...values, nowIso(), id)
      .run()
    if (!res.meta.changes) throw new HttpError(404, '글을 찾을 수 없어요.')
    return id
  }
  const now = nowIso()
  const res = await db
    .prepare(`INSERT INTO posts (type, title, content, format, excerpt, plain, thumbnail, category_id, tags, visibility, password_hash,
      pinned, allow_comments, extra, thread_id, published_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(...values, now, now)
    .run()
  return res.meta.last_row_id
}

async function listTags(db, admin) {
  const { results } = await db
    .prepare(`SELECT json_each.value AS name, COUNT(*) AS count FROM posts p, json_each(p.tags)
      WHERE p.type = 'post' ${admin ? '' : "AND p.visibility != 'private'"}
      GROUP BY json_each.value ORDER BY count DESC, name LIMIT 300`)
    .all()
  return results
}

/* ------------------------------------------------------------------ */
/* 방명록 · 댓글                                                        */
/* ------------------------------------------------------------------ */

function shapeComment(row, admin) {
  const hidden = row.secret && !admin
  return {
    id: row.id,
    postId: row.post_id,
    parentId: row.parent_id,
    name: hidden ? '비밀글' : row.name,
    body: hidden ? null : row.body,
    secret: !!row.secret,
    isAdmin: !!row.is_admin,
    createdAt: row.created_at,
  }
}

async function listComments(db, admin, params) {
  const postParam = params.get('post')
  const isGuestbook = !postParam || postParam === 'guestbook'
  if (params.get('recent') && admin) {
    const { results } = await db
      .prepare('SELECT c.*, p.title AS post_title FROM comments c LEFT JOIN posts p ON p.id = c.post_id ORDER BY c.created_at DESC LIMIT 100')
      .all()
    return { items: results.map((r) => ({ ...shapeComment(r, true), postTitle: r.post_title })) }
  }
  const limit = 20
  const page = Math.max(Number(params.get('page')) || 1, 1)
  const cond = isGuestbook ? 'post_id IS NULL' : 'post_id = ?'
  const binds = isGuestbook ? [] : [Number(postParam)]
  const order = isGuestbook ? 'DESC' : 'ASC'
  const [count, top] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS n FROM comments WHERE ${cond} AND parent_id IS NULL`).bind(...binds).first(),
    db
      .prepare(`SELECT * FROM comments WHERE ${cond} AND parent_id IS NULL ORDER BY created_at ${order} LIMIT ? OFFSET ?`)
      .bind(...binds, limit, (page - 1) * limit)
      .all(),
  ])
  const ids = top.results.map((r) => r.id)
  let replies = []
  if (ids.length) {
    const res = await db
      .prepare(`SELECT * FROM comments WHERE parent_id IN (${ids.map(() => '?').join(',')}) ORDER BY created_at ASC`)
      .bind(...ids)
      .all()
    replies = res.results
  }
  const items = top.results.map((r) => ({
    ...shapeComment(r, admin),
    replies: replies.filter((c) => c.parent_id === r.id).map((c) => shapeComment(c, admin)),
  }))
  const total = count?.n || 0
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) }
}

async function addComment(db, admin, body) {
  if (body.website) return { ok: true } // 스팸봇이 채우는 숨은 칸
  const settings = await readSettings(db)
  const features = settings.site?.features || {}
  const postId = body.postId ? Number(body.postId) : null
  if (postId) {
    const post = await db.prepare("SELECT allow_comments, visibility FROM posts WHERE id = ?").bind(postId).first()
    if (!post || (post.visibility === 'private' && !admin)) throw new HttpError(404, '글을 찾을 수 없어요.')
    if (!admin && (features.comments === false || !post.allow_comments)) throw new HttpError(403, '댓글을 쓸 수 없는 글이에요.')
  } else if (!admin && features.guestbook === false) {
    throw new HttpError(403, '방명록이 닫혀 있어요.')
  }
  const text = String(body.body || '').trim()
  if (!text) throw new HttpError(400, '내용을 적어주세요.')
  if (text.length > 3000) throw new HttpError(400, '내용은 3000자까지 쓸 수 있어요.')
  const name = clampStr(String(body.name || '').trim(), 30)
  if (!name) throw new HttpError(400, '이름을 적어주세요.')
  let passwordHash = null
  if (!admin) {
    if (!body.password || String(body.password).length < 2) throw new HttpError(400, '비밀번호를 2자 이상 적어주세요.')
    passwordHash = await hashPassword(String(body.password))
  }
  let parentId = body.parentId ? Number(body.parentId) : null
  if (parentId) {
    const parent = await db.prepare('SELECT id, parent_id FROM comments WHERE id = ?').bind(parentId).first()
    if (!parent) throw new HttpError(404, '답글을 달 글이 사라졌어요.')
    parentId = parent.parent_id || parent.id
  }
  const res = await db
    .prepare('INSERT INTO comments (post_id, parent_id, name, password_hash, body, secret, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(postId, parentId, name, passwordHash, text, body.secret ? 1 : 0, admin ? 1 : 0, nowIso())
    .run()
  return { id: res.meta.last_row_id }
}

/* ------------------------------------------------------------------ */
/* 파일 업로드                                                          */
/* ------------------------------------------------------------------ */

const ALLOWED_MIME = /^(image\/(png|jpe?g|gif|webp|avif|svg\+xml|x-icon|vnd\.microsoft\.icon)|audio\/(mpeg|mp4|ogg|wav|webm)|video\/(mp4|webm)|font\/(woff2?|ttf|otf)|application\/(font-woff2?|x-font-ttf))$/

async function uploadFile(request, env) {
  const form = await request.formData()
  const file = form.get('file')
  if (!file || typeof file === 'string') throw new HttpError(400, '파일이 없어요.')
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin'
  const FONT_EXT = { woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf' }
  let mime = file.type || 'application/octet-stream'
  if (FONT_EXT[ext] && !mime.startsWith('font/')) mime = FONT_EXT[ext]
  if ((ext === 'cur' || ext === 'ico') && !mime.startsWith('image/')) mime = 'image/x-icon'
  if (!ALLOWED_MIME.test(mime)) throw new HttpError(400, `올릴 수 없는 파일 형식이에요. (${mime})`)
  const limit = env.BUCKET ? R2_FILE_LIMIT : D1_FILE_LIMIT
  if (file.size > limit) throw new HttpError(413, `파일이 너무 커요. (최대 ${(limit / 1024 / 1024).toFixed(1)}MB)`)
  const key = `${nowIso().slice(0, 7)}/${randomId(10)}.${ext}`
  const bytes = await file.arrayBuffer()
  if (env.BUCKET) {
    await env.BUCKET.put(key, bytes, { httpMetadata: { contentType: mime } })
    await env.DB.prepare('INSERT INTO files (key, mime, size, data, created_at) VALUES (?, ?, ?, NULL, ?)').bind(key, mime, file.size, nowIso()).run()
  } else {
    await env.DB.prepare('INSERT INTO files (key, mime, size, data, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(key, mime, file.size, bytes, nowIso())
      .run()
  }
  return { url: `/files/${key}`, key, mime, size: file.size }
}

async function serveFile(request, env, url) {
  const key = decodeURIComponent(url.pathname.slice('/files/'.length))
  if (!key || key.includes('..')) return new Response('Not found', { status: 404 })
  const headers = {
    'cache-control': 'public, max-age=31536000, immutable',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
  }
  if (env.BUCKET) {
    const obj = await env.BUCKET.get(key)
    if (obj) {
      return new Response(obj.body, { headers: { ...headers, 'content-type': obj.httpMetadata?.contentType || 'application/octet-stream' } })
    }
  }
  await ensureSchema(env.DB)
  const row = await env.DB.prepare('SELECT mime, data FROM files WHERE key = ?').bind(key).first()
  if (!row || !row.data) return new Response('Not found', { status: 404 })
  return new Response(new Uint8Array(row.data), { headers: { ...headers, 'content-type': row.mime } })
}

/* ------------------------------------------------------------------ */
/* 백업                                                                */
/* ------------------------------------------------------------------ */

async function exportAll(db) {
  const [settings, categories, posts, comments] = await Promise.all([
    db.prepare("SELECT key, value FROM settings WHERE key NOT LIKE '\\_\\_%' ESCAPE '\\'").all(),
    db.prepare('SELECT * FROM categories ORDER BY sort_order').all(),
    db.prepare('SELECT * FROM posts ORDER BY id').all(),
    db.prepare('SELECT * FROM comments ORDER BY id').all(),
  ])
  return {
    format: 'our-diary-backup',
    version: 1,
    exportedAt: nowIso(),
    settings: settings.results,
    categories: categories.results,
    posts: posts.results,
    comments: comments.results,
  }
}

async function importAll(db, data) {
  if (data?.format !== 'our-diary-backup') throw new HttpError(400, '백업 파일 형식이 아니에요.')
  const stmts = [
    db.prepare('DELETE FROM settings'),
    db.prepare('DELETE FROM categories'),
    db.prepare('DELETE FROM posts'),
    db.prepare('DELETE FROM comments'),
    db.prepare('DELETE FROM post_views'),
  ]
  const insert = (table, row, columns) => {
    const cols = columns.filter((c) => c in row)
    return db.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).bind(...cols.map((c) => row[c] ?? null))
  }
  for (const s of data.settings || []) if (SETTING_KEYS.includes(s.key)) stmts.push(insert('settings', s, ['key', 'value']))
  for (const c of data.categories || []) stmts.push(insert('categories', c, ['id', 'name', 'slug', 'icon', 'description', 'list_style', 'page_type', 'parent_id', 'sort_order', 'hidden', 'config']))
  for (const p of data.posts || [])
    stmts.push(
      insert('posts', p, [
        'id', 'type', 'title', 'content', 'format', 'excerpt', 'plain', 'thumbnail', 'category_id', 'tags', 'visibility', 'password_hash',
        'pinned', 'allow_comments', 'views', 'reactions', 'extra', 'thread_id', 'published_at', 'created_at', 'updated_at',
      ]),
    )
  for (const c of data.comments || [])
    stmts.push(insert('comments', c, ['id', 'post_id', 'parent_id', 'name', 'password_hash', 'body', 'secret', 'is_admin', 'created_at']))
  // D1 batch는 하나의 트랜잭션으로 처리되어, 중간에 실패하면 전부 되돌려집니다.
  await db.batch(stmts)
}
