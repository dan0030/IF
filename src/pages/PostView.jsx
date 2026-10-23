import React, { useEffect, useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { api } from '../lib/api.js'
import { navigate } from '../lib/router.js'
import { formatDate } from '../lib/format.js'
import { useTopbarTitle } from '../components/Shell.jsx'
import { Content } from '../components/Content.jsx'
import { Comments } from '../components/Comments.jsx'
import { Empty, Spinner } from '../components/ui.jsx'
import { ThreadView } from '../components/Thread.jsx'
import { RpPostInfo, RpTitleTags, charsOf, useCategoryConfig } from './RpPage.jsx'
import { RpScriptView, isScript } from '../components/RpScript.jsx'

export default function PostView({ id }) {
  const app = useApp()
  const [post, setPost] = useState(null)
  const [error, setError] = useState(null)

  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    if (!reloadKey) setPost(null)
    setError(null)
    api
      .post(id)
      .then((p) => {
        if (!alive) return
        // 타래 중간 글 주소로 들어오면 타래 시작 글로 옮겨가요.
        if (p.replyOf) navigate(`/post/${p.replyOf}#reply-${p.id}`, { replace: true })
        else setPost(p)
      })
      .catch((e) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [id, reloadKey])

  useTopbarTitle(post?.title || '')

  useEffect(() => {
    if (post) document.title = `${post.title} :: ${app.site.title}`
  }, [post, app.site.title])

  // 역극 로그 글이면 캐릭터 정보(두상·말풍선 색)를 페이지 설정에서 불러와요
  const rpCat = post ? app.categories.find((c) => c.id === post.categoryId && c.page_type === 'rp') : null
  const [rpConfig] = useCategoryConfig(rpCat?.id || null)

  if (error) return <Empty title="글을 찾을 수 없어요">{error}</Empty>
  if (!post) return <Spinner />

  const category = app.categories.find((c) => c.id === post.categoryId)

  async function remove() {
    if (!window.confirm('이 글을 삭제할까요? 댓글도 함께 지워지고 되돌릴 수 없어요.')) return
    try {
      await api.deletePost(post.id)
      app.showToast('삭제했어요.')
      app.reload()
      navigate(category ? `/category/${category.slug}` : '/archive', { replace: true })
    } catch (e) {
      app.showToast(e.message)
    }
  }

  const isThread = !post.locked && post.type === 'post' && (category?.page_type === 'thread' || post.thread?.length > 0)
  const adminButtons = app.admin && (
    <div className="article-admin">
      <a href={`/write/${post.id}`} className="btn small">
        <i className="fa-solid fa-pen" /> 수정
      </a>
      <button type="button" className="btn small ghost danger" onClick={remove}>
        <i className="fa-solid fa-trash" /> {isThread ? '타래 전체 삭제' : '삭제'}
      </button>
    </div>
  )

  return (
    <div className="post-view">
      {isThread ? (
        <>
          {category && (
            <a href={`/category/${encodeURIComponent(category.slug)}`} className="tw-back">
              <i className="fa-solid fa-chevron-left" /> {category.name}
            </a>
          )}
          <ThreadView post={post} onChanged={() => setReloadKey((k) => k + 1)} adminTools={adminButtons} />
          {app.site.features.reactions !== false && (
            <div className="card tw-card tw-reactions">
              <Reactions post={post} />
            </div>
          )}
        </>
      ) : (
      <article className={`article card ${post.extra?.cover ? 'has-cover' : ''}`}>
        {post.extra?.cover && <div className="article-cover" style={{ backgroundImage: `url("${post.extra.cover}")` }} />}
        <header className="article-header">
          {post.type === 'notice' ? (
            <a href="/notice" className="article-category">
              공지사항
            </a>
          ) : (
            category && (
              <a href={`/category/${encodeURIComponent(category.slug)}`} className="article-category">
                {category.icon && <i className={category.icon} />} {category.name}
              </a>
            )
          )}
          <h1 className="article-title">
            {post.visibility === 'private' && <i className="fa-solid fa-eye-slash lock-icon" title="비공개" />}
            {rpCat && !post.locked && <RpTitleTags post={post} category={rpCat} config={rpConfig} />}
            {post.visibility === 'protected' && <i className="fa-solid fa-lock lock-icon" title="비밀글" />}
            {post.title}
          </h1>
          {post.subtitle && <p className="article-subtitle">{post.subtitle}</p>}
          {category?.page_type === 'rp' && !post.locked && <RpPostInfo post={post} />}
          <div className="article-meta">
            <span>{formatDate(post.publishedAt)}</span>
            {app.site.features.showViews && (
              <span>
                <i className="fa-regular fa-eye" /> {post.views}
              </span>
            )}
          </div>
          {app.admin && (
            <div className="article-admin">
              <a href={`/write/${post.id}`} className="btn small">
                <i className="fa-solid fa-pen" /> 수정
              </a>
              <button type="button" className="btn small ghost danger" onClick={remove}>
                <i className="fa-solid fa-trash" /> 삭제
              </button>
            </div>
          )}
        </header>

        {post.locked ? (
          <Unlock post={post} onUnlocked={setPost} />
        ) : (
          <>
            {rpCat && isScript(post.content) ? <RpScriptView html={post.content} chars={charsOf(rpConfig, app.site)} /> : <Content html={post.content} />}
            {post.tags?.length > 0 && (
              <div className="article-tags">
                {post.tags.map((t) => (
                  <a key={t} href={`/tag/${encodeURIComponent(t)}`} className="chip">
                    #{t}
                  </a>
                ))}
              </div>
            )}
            {app.site.features.reactions !== false && <Reactions post={post} />}
          </>
        )}
      </article>
      )}

      <nav className="article-nav">
        {post.prev ? (
          <a href={`/post/${post.prev.id}`} className="nav-card prev">
            <i className="fa-solid fa-chevron-left" />
            <span>
              <small>이전 글</small>
              {post.prev.title}
            </span>
          </a>
        ) : (
          <span />
        )}
        {post.next ? (
          <a href={`/post/${post.next.id}`} className="nav-card next">
            <span>
              <small>다음 글</small>
              {post.next.title}
            </span>
            <i className="fa-solid fa-chevron-right" />
          </a>
        ) : (
          <span />
        )}
      </nav>

      {post.related?.length > 0 && (
        <section className="related card">
          <h3>'{category?.name}' 카테고리의 다른 글</h3>
          <ul>
            {post.related.map((r) => (
              <li key={r.id}>
                <a href={`/post/${r.id}`}>
                  <span className="rel-title">
                    {r.locked && <i className="fa-solid fa-lock lock-icon" />}
                    {r.title}
                  </span>
                  <span className="rel-date">{formatDate(r.publishedAt)}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!post.locked && app.site.features.comments !== false && post.allowComments && <Comments postId={post.id} title="댓글" />}
    </div>
  )
}

function Unlock({ post, onUnlocked }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onUnlocked(await api.unlock(post.id, password))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="protected" onSubmit={submit}>
      <i className="fa-solid fa-lock protected-icon" />
      <h2>비밀글입니다.</h2>
      <p>{post.extra?.hint || '이 글의 내용을 보시려면 비밀번호를 입력해주세요.'}</p>
      <div className="protected-form">
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" autoFocus aria-label="비밀번호" />
        <button type="submit" className="btn primary" disabled={busy || !password}>
          확인
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </form>
  )
}

function Reactions({ post }) {
  const app = useApp()
  const storageKey = `od-react-${post.id}`
  const [counts, setCounts] = useState(post.reactions || {})
  const [mine, setMine] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '[]')
    } catch {
      return []
    }
  })
  const emojis = app.site.reactions?.length ? app.site.reactions : ['❤️']

  async function toggle(emoji) {
    const undo = mine.includes(emoji)
    const nextMine = undo ? mine.filter((e) => e !== emoji) : [...mine, emoji]
    setMine(nextMine)
    setCounts((c) => ({ ...c, [emoji]: Math.max(0, (c[emoji] || 0) + (undo ? -1 : 1)) }))
    try {
      localStorage.setItem(storageKey, JSON.stringify(nextMine))
    } catch {
      // 무시
    }
    try {
      const res = await api.react(post.id, emoji, undo)
      setCounts(res.reactions)
    } catch (e) {
      app.showToast(e.message)
    }
  }

  return (
    <div className="reactions">
      {emojis.map((e) => (
        <button type="button" key={e} className={mine.includes(e) ? 'active' : ''} onClick={() => toggle(e)} aria-pressed={mine.includes(e)}>
          <span className="reaction-emoji">{e}</span>
          {counts[e] > 0 && <span className="reaction-count">{counts[e]}</span>}
        </button>
      ))}
    </div>
  )
}
