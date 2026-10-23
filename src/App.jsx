import React from 'react'
import { AppProvider, useApp } from './lib/store.jsx'
import { matchRoute, useLocation } from './lib/router.js'
import { BgmProvider } from './components/Bgm.jsx'
import { Shell } from './components/Shell.jsx'
import { Spinner } from './components/ui.jsx'
import Home from './pages/Home.jsx'
import Archive from './pages/Archive.jsx'
import PostView from './pages/PostView.jsx'
import Write from './pages/Write.jsx'
import Admin from './admin/Admin.jsx'
import BannersPage from './pages/Banners.jsx'
import { CalendarPage, GuestbookPage, LoginPage, NotFound, TagsPage } from './pages/Misc.jsx'

function Router() {
  const app = useApp()
  const loc = useLocation()

  if (app.error) {
    return (
      <div className="boot-error">
        <i className="fa-solid fa-plug-circle-exclamation" />
        <h1>사이트를 불러오지 못했어요</h1>
        <p>{app.error}</p>
        <button type="button" className="btn primary" onClick={app.reload}>
          다시 시도
        </button>
      </div>
    )
  }
  if (!app.ready) return <div className="boot"><Spinner /></div>

  const { name, params } = matchRoute(loc.path)
  let page
  switch (name) {
    case 'home':
      page = <Home />
      break
    case 'archive':
      page = <Archive kind="archive" search={loc.search} />
      break
    case 'category':
      page = <Archive key={params[0]} kind="category" param={params[0]} search={loc.search} />
      break
    case 'tag':
      page = <Archive key={params[0]} kind="tag" param={params[0]} search={loc.search} />
      break
    case 'search':
      page = <Archive kind="search" search={loc.search} />
      break
    case 'notice':
      page = <Archive kind="notice" search={loc.search} />
      break
    case 'post':
      page = <PostView id={params[0]} />
      break
    case 'guestbook':
      page = <GuestbookPage />
      break
    case 'tags':
      page = <TagsPage />
      break
    case 'calendar':
      page = <CalendarPage />
      break
    case 'banners':
      page = <BannersPage />
      break
    case 'login':
      page = <LoginPage />
      break
    case 'write':
      page = <Write key={params[0] || 'new'} id={params[0]} />
      break
    case 'admin':
      page = <Admin tab={params[0]} />
      break
    default:
      page = <NotFound />
  }
  return (
    <BgmProvider>
      <Shell>
        <div className="page-inner" key={loc.path}>
          {page}
        </div>
      </Shell>
    </BgmProvider>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  )
}
