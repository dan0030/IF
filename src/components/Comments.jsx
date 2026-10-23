import React, { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { useApp } from '../lib/store.jsx'
import { formatDateTime } from '../lib/format.js'
import { Paging, Spinner } from './ui.jsx'

// 방명록과 글 댓글이 같이 쓰는 컴포넌트입니다. postId가 없으면 방명록이에요.
export function Comments({ postId = null, title }) {
  const app = useApp()
  const [data, setData] = useState(null)
  const [page, setPage] = useState(1)
  const [replyTo, setReplyTo] = useState(null)

  const load = useCallback(async () => {
    const res = await api.comments({ post: postId || 'guestbook', page })
    setData(res)
  }, [postId, page])

  useEffect(() => {
    load().catch((e) => app.showToast(e.message))
  }, [load])

  async function remove(c) {
    let password = ''
    if (!app.admin) {
      password = window.prompt('작성할 때 적은 비밀번호를 입력해주세요.')
      if (!password) return
    } else if (!window.confirm('이 글을 삭제할까요? 답글도 함께 지워져요.')) return
    try {
      await api.deleteComment(c.id, password)
      app.showToast('삭제했어요.')
      load()
    } catch (e) {
      app.showToast(e.message)
    }
  }

  return (
    <section className="comments">
      {title && <h2 className="section-title">{title}</h2>}
      <CommentForm postId={postId} onDone={load} />
      {!data ? (
        <Spinner />
      ) : data.items.length === 0 ? (
        <p className="comments-empty">아직 남겨진 글이 없어요.</p>
      ) : (
        <ul className="comment-list">
          {data.items.map((c) => (
            <li key={c.id} className="comment-item card">
              <CommentBody c={c} onDelete={() => remove(c)} onReply={() => setReplyTo(replyTo === c.id ? null : c.id)} />
              {c.replies?.length > 0 && (
                <ul className="reply-list">
                  {c.replies.map((r) => (
                    <li key={r.id} className="reply-item">
                      <CommentBody c={r} onDelete={() => remove(r)} />
                    </li>
                  ))}
                </ul>
              )}
              {replyTo === c.id && (
                <CommentForm
                  postId={postId}
                  parentId={c.id}
                  compact
                  onDone={() => {
                    setReplyTo(null)
                    load()
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {data && <Paging page={data.page} pages={data.pages} onChange={setPage} />}
    </section>
  )
}

function CommentBody({ c, onDelete, onReply }) {
  const { site } = useApp()
  return (
    <div className={`comment ${c.isAdmin ? 'by-admin' : ''}`}>
      <div className="comment-meta">
        <span className="comment-name">
          {c.isAdmin && site.pair.me.image ? <img src={site.pair.me.image} alt="" className="comment-avatar" /> : null}
          {c.name}
          {c.isAdmin && <span className="badge">주인</span>}
          {c.secret && <i className="fa-solid fa-lock lock-icon" aria-label="비밀글" />}
        </span>
        <span className="comment-date">{formatDateTime(c.createdAt)}</span>
      </div>
      <div className="comment-text">{c.body === null ? '주인만 볼 수 있는 비밀글이에요.' : c.body}</div>
      <div className="comment-actions">
        {onReply && (
          <button type="button" onClick={onReply}>
            답글
          </button>
        )}
        <button type="button" onClick={onDelete}>
          삭제
        </button>
      </div>
    </div>
  )
}

function CommentForm({ postId, parentId = null, compact = false, onDone }) {
  const app = useApp()
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem('od-comment-name') || ''
    } catch {
      return ''
    }
  })
  const [password, setPassword] = useState('')
  const [body, setBody] = useState('')
  const [secret, setSecret] = useState(false)
  const [website, setWebsite] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await api.addComment({
        postId,
        parentId,
        name: app.admin ? app.site.pair.me.name || '주인' : name,
        password,
        body,
        secret,
        website,
      })
      try {
        if (!app.admin) localStorage.setItem('od-comment-name', name)
      } catch {
        // 무시
      }
      setBody('')
      setPassword('')
      setSecret(false)
      onDone?.()
    } catch (err) {
      app.showToast(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className={`comment-form ${compact ? 'compact' : 'card'}`} onSubmit={submit}>
      {!app.admin && (
        <div className="comment-form-row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" maxLength={30} required aria-label="이름" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" required aria-label="비밀번호" />
        </div>
      )}
      <input className="hp-field" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} aria-hidden="true" />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={parentId ? '답글을 남겨주세요.' : postId ? '댓글을 남겨주세요.' : app.site.guestbookIntro || '방명록을 남겨주세요.'}
        rows={compact ? 2 : 3}
        maxLength={3000}
        required
        aria-label="내용"
      />
      <div className="comment-form-foot">
        <label className="check">
          <input type="checkbox" checked={secret} onChange={(e) => setSecret(e.target.checked)} />
          <span>
            <i className="fa-solid fa-lock" /> 비밀글
          </span>
        </label>
        <button type="submit" className="btn primary small" disabled={busy}>
          {busy ? '등록 중' : '등록'}
        </button>
      </div>
    </form>
  )
}
