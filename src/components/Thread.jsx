import React, { useCallback, useEffect, useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { api } from '../lib/api.js'
import { pad, parseDate } from '../lib/format.js'
import { Content } from './Content.jsx'
import { Empty, Paging, Spinner } from './ui.jsx'
import { RichEditor } from '../editor/RichEditor.jsx'

/* ==================================================================
   타임라인 타래 (트위터 스레드처럼 글 아래로 글을 이어 다는 페이지)
   ================================================================== */

function nowLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function tweetTime(str, long = false) {
  const d = parseDate(str)
  if (!d) return ''
  const h = d.getHours()
  const time = `${h < 12 ? '오전' : '오후'} ${((h + 11) % 12) + 1}:${pad(d.getMinutes())}`
  if (long) return `${time} · ${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff >= 0 && diff < 60) return '방금'
  if (diff >= 0 && diff < 3600) return `${Math.floor(diff / 60)}분`
  if (diff >= 0 && diff < 86400) return `${Math.floor(diff / 3600)}시간`
  return d.getFullYear() === new Date().getFullYear() ? `${d.getMonth() + 1}월 ${d.getDate()}일` : `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

function who(site, author) {
  return author === 'partner' ? site.pair.partner : site.pair.me
}

function TwAvatar({ person }) {
  return (
    <span className="tw-avatar" style={{ '--ring': person.color || 'var(--accent)' }}>
      {person.image ? <img src={person.image} alt="" /> : <span>{(person.name || '?').slice(0, 1)}</span>}
    </span>
  )
}

function TwHead({ person, time, long }) {
  return (
    <div className={`tw-head ${long ? 'long' : ''}`}>
      <strong className="tw-name">{person.name}</strong>
      {person.sub && <span className="tw-handle">{person.sub}</span>}
      {!long && time && (
        <>
          <span className="tw-dot">·</span>
          <span className="tw-time">{time}</span>
        </>
      )}
    </div>
  )
}

function AuthorPicker({ value, onChange }) {
  const { site } = useApp()
  return (
    <div className="tw-author-pick" role="radiogroup" aria-label="누구의 글인가요">
      {['me', 'partner'].map((k) => {
        const p = who(site, k)
        return (
          <button type="button" key={k} role="radio" aria-checked={value === k} className={value === k ? 'active' : ''} onClick={() => onChange(k)}>
            <TwAvatar person={p} />
            <span>{p.name}</span>
          </button>
        )
      })}
    </div>
  )
}

// 새 타래 시작 / 타래 잇기 / 수정 모두 이 입력창을 써요.
function Composer({ initial = '', initialAuthor = 'me', placeholder, submitLabel, onSubmit, onCancel, compact, allowSecret = false }) {
  const [content, setContent] = useState(initial)
  const [mode, setMode] = useState('rich')
  const [author, setAuthor] = useState(initialAuthor)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(!compact || !!initial)
  // 새 타래는 비밀번호를 건 비밀글로도 올릴 수 있어요.
  const [secret, setSecret] = useState(false)
  const [password, setPassword] = useState('')
  const [hint, setHint] = useState('')
  const empty = !content.replace(/<br\s*\/?>|<\/?p>|&nbsp;|\s/g, '')

  async function submit() {
    if (empty) return
    if (secret && !password.trim()) return
    setBusy(true)
    try {
      await onSubmit({ content, format: mode, author, ...(secret ? { visibility: 'protected', password: password.trim(), hint: hint.trim() } : {}) })
      setContent('')
      setSecret(false)
      setPassword('')
      setHint('')
      if (compact && !initial) setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button type="button" className="tw-compose-open" onClick={() => setOpen(true)}>
        <i className="fa-solid fa-plus" /> {placeholder}
      </button>
    )
  }

  return (
    <div className="tw-composer">
      <AuthorPicker value={author} onChange={setAuthor} />
      <div className="tw-composer-editor">
        <RichEditor value={content} onChange={setContent} mode={mode} onModeChange={setMode} />
      </div>
      {allowSecret && secret && (
        <div className="tw-secret-fields">
          <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" aria-label="비밀글 비밀번호" autoComplete="off" />
          <input type="text" value={hint} onChange={(e) => setHint(e.target.value)} placeholder="비밀번호 힌트 (선택)" aria-label="비밀번호 힌트" />
        </div>
      )}
      <div className="tw-composer-foot">
        {onCancel || compact ? (
          <button
            type="button"
            className="btn small ghost"
            onClick={() => {
              if (onCancel) onCancel()
              else setOpen(false)
            }}
          >
            취소
          </button>
        ) : (
          <span />
        )}
        {allowSecret && (
          <button type="button" className={`btn small ${secret ? 'tonal' : 'ghost'} tw-secret-toggle`} aria-pressed={secret} onClick={() => setSecret((v) => !v)} title="비밀번호를 건 비밀글로 올리기">
            <i className={`fa-solid ${secret ? 'fa-lock' : 'fa-lock-open'}`} /> 비밀글
          </button>
        )}
        <button type="button" className="btn small primary" onClick={submit} disabled={busy || empty || (secret && !password.trim())}>
          {busy ? '올리는 중...' : submitLabel}
        </button>
      </div>
    </div>
  )
}

/* ---------------- 타래 목록 (카테고리 페이지) ---------------- */

export function ThreadFeed({ category, search }) {
  const app = useApp()
  const page = Number(new URLSearchParams(search).get('page')) || 1
  const [data, setData] = useState(null)
  const [pageNo, setPageNo] = useState(page)

  const load = useCallback(() => {
    return api.posts({ category: category.slug, page: pageNo, limit: 10, full: 1 }).then(setData)
  }, [category.slug, pageNo])

  useEffect(() => {
    setData(null)
    load().catch((e) => app.showToast(e.message))
  }, [load])

  async function startThread({ content, format, author, visibility, password, hint }) {
    try {
      await api.createPost({ title: '', content, format, author, categoryId: category.id, publishedAt: nowLocal(), visibility, password, extra: hint ? { hint } : undefined })
      app.showToast('타래를 시작했어요.')
      app.reload()
      setPageNo(1)
      load()
    } catch (e) {
      app.showToast(e.message)
      throw e
    }
  }

  return (
    <div className="tw-feed">
      {app.admin && (
        <div className="card tw-card tw-compose-card">
          <Composer compact allowSecret placeholder="새 타래 시작하기" submitLabel="게시하기" onSubmit={startThread} />
        </div>
      )}
      {!data ? (
        <Spinner />
      ) : data.items.length === 0 ? (
        <Empty icon="fa-solid fa-feather" title="아직 타래가 없어요">
          {app.admin ? '위에서 첫 타래를 시작해보세요.' : null}
        </Empty>
      ) : (
        data.items.map((p) => <FeedItem key={p.id} post={p} />)
      )}
      {data && <Paging page={data.page} pages={data.pages} onChange={setPageNo} />}
    </div>
  )
}

function FeedItem({ post }) {
  const { site } = useApp()
  const person = who(site, post.author)
  return (
    <article className="card tw-card tw-feed-item">
      <div className="tw-row">
        <div className="tw-side">
          <TwAvatar person={person} />
        </div>
        <div className="tw-main">
          <TwHead person={person} time={tweetTime(post.publishedAt)} />
          {post.locked ? (
            <a href={`/post/${post.id}`} className="tw-locked">
              <i className="fa-solid fa-lock" /> 비밀글 타래예요. 눌러서 비밀번호를 입력해주세요.
            </a>
          ) : (
            <a href={`/post/${post.id}`} className="tw-content-link">
              <div className="tw-content clamp">
                <Content html={post.content} className="prose tw-prose" runScripts={false} />
              </div>
            </a>
          )}
          <div className="tw-actions">
            <a href={`/post/${post.id}`} className={post.replyCount ? 'accent' : ''}>
              <i className="fa-solid fa-diagram-next" /> {post.replyCount ? `타래 ${post.replyCount}개 이어보기` : '타래 보기'}
            </a>
            {post.commentCount > 0 && (
              <span>
                <i className="fa-regular fa-comment" /> {post.commentCount}
              </span>
            )}
            {post.visibility === 'private' && (
              <span>
                <i className="fa-solid fa-eye-slash" /> 비공개
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

/* ---------------- 타래 보기 (글 하나 + 이어진 글들) ---------------- */

export function ThreadView({ post, onChanged, adminTools }) {
  const app = useApp()
  const { site } = app
  const replies = post.thread || []
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    // 타래 중간 글로 들어온 경우 그 글로 스크롤해요.
    const hash = window.location.hash
    if (hash.startsWith('#reply-')) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'center' })
  }, [post.id])

  async function addReply({ content, format, author }) {
    try {
      await api.createPost({ type: 'reply', threadId: post.id, content, format, author, publishedAt: nowLocal() })
      onChanged()
    } catch (e) {
      app.showToast(e.message)
      throw e
    }
  }

  async function saveReply(r, { content, format, author }) {
    try {
      await api.updatePost(r.id, { type: 'reply', threadId: post.id, content, format, author, extra: r.extra, publishedAt: r.publishedAt })
      setEditing(null)
      onChanged()
    } catch (e) {
      app.showToast(e.message)
      throw e
    }
  }

  async function removeReply(r) {
    if (!window.confirm('이 글을 타래에서 지울까요?')) return
    try {
      await api.deletePost(r.id)
      onChanged()
    } catch (e) {
      app.showToast(e.message)
    }
  }

  const rootPerson = who(site, post.author)
  const hasMore = replies.length > 0 || app.admin

  return (
    <article className="card tw-card tw-thread">
      <div className={`tw-row root ${hasMore ? 'has-next' : ''}`}>
        <div className="tw-side">
          <TwAvatar person={rootPerson} />
          <span className="tw-line" />
        </div>
        <div className="tw-main">
          <TwHead person={rootPerson} long />
          <div className="tw-content big">
            <Content html={post.content} className="prose tw-prose" />
          </div>
          <div className="tw-time-long">{tweetTime(post.publishedAt, true)}</div>
          {adminTools}
        </div>
      </div>

      {replies.map((r, i) => {
        const person = who(site, r.author)
        const last = i === replies.length - 1 && !app.admin
        return (
          <div className={`tw-row ${last ? '' : 'has-next'}`} key={r.id} id={`reply-${r.id}`}>
            <div className="tw-side">
              <TwAvatar person={person} />
              <span className="tw-line" />
            </div>
            <div className="tw-main">
              <TwHead person={person} time={tweetTime(r.publishedAt)} />
              {editing === r.id ? (
                <Composer initial={r.content} initialAuthor={r.author} submitLabel="저장" onSubmit={(v) => saveReply(r, v)} onCancel={() => setEditing(null)} />
              ) : (
                <div className="tw-content">
                  <Content html={r.content} className="prose tw-prose" />
                </div>
              )}
              {app.admin && editing !== r.id && (
                <div className="tw-actions small">
                  <button type="button" onClick={() => setEditing(r.id)}>
                    <i className="fa-solid fa-pen" /> 수정
                  </button>
                  <button type="button" className="danger" onClick={() => removeReply(r)}>
                    <i className="fa-solid fa-trash" /> 삭제
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {app.admin && (
        <div className="tw-row tw-add">
          <div className="tw-side">
            <span className="tw-avatar add">
              <i className="fa-solid fa-plus" />
            </span>
          </div>
          <div className="tw-main">
            <Composer compact placeholder="타래 잇기" submitLabel="이어 달기" onSubmit={addReply} />
          </div>
        </div>
      )}
    </article>
  )
}
