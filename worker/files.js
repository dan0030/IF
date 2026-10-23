// 올린 파일 관리: R2 저장 · 예전 D1 파일을 R2로 옮기기 · 더 이상 쓰지 않는 파일 지우기
//
// 파일 주소는 항상 /files/YYYY-MM/아이디.확장자 꼴이라, 글·설정 안에서 이 모양만 찾으면
// 어떤 파일이 어디서 쓰이는지 알 수 있어요.

const KEY_RE = /\/files\/(\d{4}-\d{2}\/[A-Za-z0-9_-]+\.[a-z0-9]{1,5})/g

export function extractKeys(...texts) {
  const keys = new Set()
  for (const t of texts) {
    if (!t) continue
    for (const m of String(t).matchAll(KEY_RE)) keys.add(m[1])
  }
  return keys
}

// 글(과 그 타래에 이어 단 글)에 들어 있는 파일들
export async function keysOfPosts(db, ids) {
  if (!ids.length) return new Set()
  const marks = ids.map(() => '?').join(',')
  const { results } = await db
    .prepare(`SELECT content, thumbnail, extra FROM posts WHERE id IN (${marks}) OR thread_id IN (${marks})`)
    .bind(...ids, ...ids)
    .all()
  return extractKeys(...results.flatMap((r) => [r.content, r.thumbnail, r.extra]))
}

export async function keysOfCategories(db, ids) {
  if (!ids.length) return new Set()
  const { results } = await db
    .prepare(`SELECT config FROM categories WHERE id IN (${ids.map(() => '?').join(',')})`)
    .bind(...ids)
    .all()
  return extractKeys(...results.map((r) => r.config))
}

export async function keysOfSetting(db, key) {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first()
  return extractKeys(row?.value)
}

// 사이트 어딘가(글·설정·댓글)에서 아직 쓰이는지
async function isReferenced(db, key) {
  const like = `%/files/${key}%`
  const row = await db
    .prepare(
      `SELECT
        EXISTS (SELECT 1 FROM posts WHERE content LIKE ?1 OR thumbnail LIKE ?1 OR extra LIKE ?1) OR
        EXISTS (SELECT 1 FROM settings WHERE value LIKE ?1) OR
        EXISTS (SELECT 1 FROM categories WHERE config LIKE ?1) OR
        EXISTS (SELECT 1 FROM comments WHERE body LIKE ?1) AS used`,
    )
    .bind(like)
    .first()
  return !!row?.used
}

export async function deleteFile(env, key) {
  if (env.BUCKET) await env.BUCKET.delete(key)
  await env.DB.prepare('DELETE FROM files WHERE key = ?').bind(key).run()
}

// 바뀌기 전에는 쓰였지만 이제 아무 데서도 안 쓰는 파일만 지워요.
export async function removeUnused(env, candidates) {
  const removed = []
  for (const key of candidates) {
    try {
      if (!(await isReferenced(env.DB, key))) {
        await deleteFile(env, key)
        removed.push(key)
      }
    } catch (err) {
      console.error('파일 정리 실패', key, err)
    }
  }
  return removed
}

export function difference(before, after) {
  return [...before].filter((k) => !after.has(k))
}

// 사이트 전체에서 쓰이는 파일 목록 (관리 화면의 "사용 중" 표시용)
export async function allReferencedKeys(db) {
  const [posts, settings, comments, cats] = await Promise.all([
    db.prepare('SELECT content, thumbnail, extra FROM posts').all(),
    db.prepare('SELECT value FROM settings').all(),
    db.prepare("SELECT body FROM comments WHERE body LIKE '%/files/%'").all(),
    db.prepare('SELECT config FROM categories WHERE config IS NOT NULL').all(),
  ])
  return extractKeys(
    ...posts.results.flatMap((r) => [r.content, r.thumbnail, r.extra]),
    ...settings.results.map((r) => r.value),
    ...cats.results.map((r) => r.config),
    ...comments.results.map((r) => r.body),
  )
}

// 예전에 D1 안에 저장했던 파일을 R2로 조금씩 옮겨요. (한 번에 너무 많이 하면 시간 제한에 걸려서)
let migrationDone = false

export async function migrateToR2(env, limit = 5, force = false) {
  if (!env.BUCKET || (migrationDone && !force)) return { moved: 0, remaining: 0 }
  const { results } = await env.DB.prepare('SELECT key, mime, data FROM files WHERE data IS NOT NULL LIMIT ?').bind(limit).all()
  for (const row of results) {
    await env.BUCKET.put(row.key, new Uint8Array(row.data), { httpMetadata: { contentType: row.mime } })
    await env.DB.prepare('UPDATE files SET data = NULL WHERE key = ?').bind(row.key).run()
  }
  const left = await env.DB.prepare('SELECT COUNT(*) AS n FROM files WHERE data IS NOT NULL').first()
  migrationDone = !left?.n
  return { moved: results.length, remaining: left?.n || 0 }
}
