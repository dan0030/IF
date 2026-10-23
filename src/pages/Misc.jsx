import React, { useEffect, useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { api } from '../lib/api.js'
import { navigate } from '../lib/router.js'
import { LargeTitle } from '../components/Shell.jsx'
import { Comments } from '../components/Comments.jsx'
import { PostList } from '../components/PostList.jsx'
import { Empty, Spinner } from '../components/ui.jsx'
import { CalendarWidget } from '../widgets/index.jsx'
import { WidgetFrame } from './Home.jsx'

function usePageTitle(title) {
  const { site } = useApp()
  useEffect(() => {
    document.title = `${title} :: ${site.title}`
  }, [title, site.title])
}

export function GuestbookPage() {
  const { site } = useApp()
  usePageTitle('방명록')
  if (site.features.guestbook === false) return <Empty title="방명록이 닫혀 있어요" />
  return (
    <div className="guestbook">
      <LargeTitle pageKey="guestbook" title="방명록" subtitle={site.guestbookIntro} />
      <Comments />
    </div>
  )
}

export function TagsPage() {
  const [tags, setTags] = useState(null)
  usePageTitle('태그')
  useEffect(() => {
    api.tags().then((res) => setTags(res.tags))
  }, [])
  return (
    <div>
      <LargeTitle pageKey="tags" title="태그 모음" subtitle={tags ? `${tags.length}개의 태그` : ''} />
      {!tags ? (
        <Spinner />
      ) : tags.length === 0 ? (
        <Empty icon="fa-solid fa-hashtag" title="아직 태그가 없어요" />
      ) : (
        <div className="card padded">
          <ul className="tag-cloud">
            {tags.map((t) => (
              <li key={t.name}>
                <a href={`/tag/${encodeURIComponent(t.name)}`}>
                  #{t.name}
                  <small>{t.count}</small>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function CalendarPage() {
  const app = useApp()
  const [month, setMonth] = useState(null)
  const [posts, setPosts] = useState(null)
  usePageTitle('캘린더')

  // 홈 화면의 캘린더 위젯에 적어둔 일정이 있으면 여기서도 같이 보여줘요.
  const homeCal = app.home.pages.flatMap((p) => p.widgets).find((w) => w.type === 'calendar')
  const config = { showAnniversary: true, showList: true, ...(homeCal?.config || {}), hideTitle: false, title: '' }

  useEffect(() => {
    if (!month) return
    let alive = true
    setPosts(null)
    api.posts({ date: month, limit: 60, sort: 'oldest', pinned: 0 }).then((res) => alive && setPosts(res.items))
    return () => {
      alive = false
    }
  }, [month])

  return (
    <div className="calendar-page">
      <LargeTitle pageKey="calendar" title="캘린더" subtitle="날짜별로 모아보는 우리의 기록" />
      <WidgetFrame widget={{ type: 'calendar', size: 'L', config: {} }}>
        <CalendarWidget config={config} size="L" onMonthChange={setMonth} />
      </WidgetFrame>
      {app.admin && (
        <p className="cal-admin-hint">
          <i className="fa-solid fa-circle-info" /> 날짜를 누르면 그날에 일정을 넣을 수 있어요. 넣은 일정은 홈의 캘린더 위젯에도 같이 보여요.
        </p>
      )}
      {month && app.site.pages?.calendar?.listTitle !== ' ' && (
        <h2 className="section-title">
          {(app.site.pages?.calendar?.listTitle || '{년}년 {월}월의 기록').replace('{년}', month.slice(0, 4)).replace('{월}', String(Number(month.slice(5))))}
        </h2>
      )}
      {!posts ? <Spinner /> : posts.length ? <PostList items={posts} style="timeline" /> : <Empty icon="fa-regular fa-calendar" title="이 달에는 기록이 없어요" />}
    </div>
  )
}

export function LoginPage() {
  const app = useApp()
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  usePageTitle('로그인')

  useEffect(() => {
    if (app.admin) navigate('/admin', { replace: true })
  }, [app.admin])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.login(password)
      await app.reload()
      app.showToast('로그인했어요.')
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <LargeTitle title="로그인" subtitle="주인만 들어올 수 있어요." />
      <form className="card padded login-card" onSubmit={submit}>
        <i className="fa-solid fa-key login-icon" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="관리자 비밀번호" autoFocus aria-label="관리자 비밀번호" autoComplete="current-password" />
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="btn primary block" disabled={busy || !password}>
          {busy ? '확인 중...' : '로그인'}
        </button>
      </form>
    </div>
  )
}

export function NotFound() {
  usePageTitle('찾을 수 없음')
  return (
    <div>
      <LargeTitle title="페이지를 찾을 수 없어요" />
      <Empty icon="fa-regular fa-compass" title="주소를 다시 확인해주세요">
        <a href="/" className="btn primary">
          홈으로
        </a>
      </Empty>
    </div>
  )
}
