import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { swapNames, useApp } from '../lib/store.jsx'
import { navigate, scrollRoot, scrollTop, useLocation } from '../lib/router.js'
import { api } from '../lib/api.js'
import { isRecent } from '../lib/format.js'
import { BgmCard } from './Bgm.jsx'

const TitleContext = createContext({ setTitle: () => {}, setCollapsed: () => {} })

export function Shell({ children }) {
  const app = useApp()
  const loc = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [collapsed, setCollapsed] = useState(true)
  const nav = app.theme.navStyle
  // 배경이 사진·패턴이면 본문을 브라우저 창 모양 판 위에 올려서 글자가 잘 보이게 해요.
  const t = app.theme
  const busyBg = t.bgType === 'image' || t.bgType === 'pattern'
  const useFrame = (t.contentFrame === 'always' || (t.contentFrame !== 'never' && busyBg)) && (loc.path !== '/' || t.frameOnHome)

  useEffect(() => {
    setDrawerOpen(false)
  }, [loc.path, loc.search])

  useEffect(() => {
    document.body.classList.toggle('no-scroll', drawerOpen)
    if (!drawerOpen) return
    const onKey = (e) => e.key === 'Escape' && setDrawerOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  return (
    <TitleContext.Provider value={{ setTitle, setCollapsed }}>
      <div className={`app nav-${nav}`}>
        {nav !== 'bottom' && <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />}
        <div className={`drawer-dim ${drawerOpen ? 'active' : ''}`} onClick={() => setDrawerOpen(false)} />
        {/* 본문 창을 쓸 땐 상단바 버튼들이 창의 주소줄 안으로 들어가요. */}
        {!useFrame && <TopBar title={title} collapsed={collapsed} onMenu={() => setDrawerOpen(true)} showMenu={nav !== 'bottom'} />}
        <main className={`page ${useFrame ? 'framed' : ''}`} id="main">
          {useFrame ? (
            <BrowserFrame path={loc.path + loc.search} showUrl={app.theme.frameBar !== false} onMenu={nav !== 'bottom' ? () => setDrawerOpen(true) : null}>
              {children}
            </BrowserFrame>
          ) : (
            children
          )}
        </main>
        <Footer />
        {nav !== 'drawer' && <BottomNav path={loc.path} />}
        <ScrollTopButton />
        {app.toast && (
          <div className="toast" key={app.toast.id} role="status">
            {app.toast.message}
          </div>
        )}
      </div>
    </TitleContext.Provider>
  )
}

// 큰 제목 없이 상단바 제목만 정할 때 씁니다.
export function useTopbarTitle(title) {
  const { setTitle, setCollapsed } = useContext(TitleContext)
  useEffect(() => {
    if (title === undefined) return
    setTitle(title)
    setCollapsed(true)
  }, [title, setTitle, setCollapsed])
}

/* One UI 특유의 “큰 제목” 영역. 스크롤해서 제목이 사라지면 상단바에 작은 제목이 나타나요. */
// pageKey를 주면 관리 › 페이지 문구에서 바꾼 제목·문구가 기본값 대신 쓰여요.
export function LargeTitle({ pageKey, title: defaultTitle, subtitle: defaultSubtitle, children, eyebrow: defaultEyebrow, className = '', style }) {
  const { setTitle, setCollapsed } = useContext(TitleContext)
  const ref = useRef(null)
  const { site } = useApp()
  const custom = (pageKey && site.pages?.[pageKey]) || {}
  const title = custom.title || defaultTitle
  const subtitle = custom.hideSubtitle ? null : custom.subtitle ? <span dangerouslySetInnerHTML={{ __html: swapNames(custom.subtitle, site) }} /> : defaultSubtitle
  const eyebrow = custom.eyebrow ? <span dangerouslySetInnerHTML={{ __html: swapNames(custom.eyebrow, site) }} /> : defaultEyebrow

  useEffect(() => {
    setTitle(title)
    const el = ref.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([entry]) => setCollapsed(!entry.isIntersecting), { rootMargin: '-56px 0px 0px 0px' })
    io.observe(el)
    return () => {
      io.disconnect()
      setCollapsed(true)
    }
  }, [title, setTitle, setCollapsed])

  return (
    <header className={`large-title ${custom.align ? `align-${custom.align}` : ''} ${className}`} style={style}>
      <div className="large-title-inner">
        {custom.image && <img className="large-title-image" src={custom.image} alt="" />}
        {eyebrow && <div className="large-title-eyebrow">{eyebrow}</div>}
        <h1 ref={ref}>{title}</h1>
        {subtitle && <div className="large-title-sub">{subtitle}</div>}
        {children}
      </div>
    </header>
  )
}

function TopBar({ title, collapsed, onMenu, showMenu }) {
  const app = useApp()
  return (
    <div className={`topbar ${collapsed ? 'show-title' : ''}`}>
      <div className="topbar-inner">
        {showMenu ? (
          <button type="button" className="icon-btn" onClick={onMenu} aria-label="메뉴 열기">
            <i className="fa-solid fa-bars" />
          </button>
        ) : (
          <a href="/" className="icon-btn" aria-label="홈">
            <i className="fa-solid fa-house" />
          </a>
        )}
        <div className="topbar-title">{title}</div>
        <div className="topbar-actions">
          <a href="/search" className="icon-btn" aria-label="검색">
            <i className="fa-solid fa-magnifying-glass" />
          </a>
          {app.theme.allowToggle !== false && (
            <button type="button" className="icon-btn" onClick={app.toggleMode} aria-label={app.mode === 'dark' ? '라이트 모드로' : '다크 모드로'}>
              <i className={`fa-solid ${app.mode === 'dark' ? 'fa-sun' : 'fa-moon'}`} />
            </button>
          )}
          {app.admin && (
            <a href="/write" className="icon-btn accent" aria-label="글쓰기">
              <i className="fa-solid fa-pen" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function Drawer({ open, onClose }) {
  const app = useApp()
  const { site } = app
  const [q, setQ] = useState('')
  const [openCats, setOpenCats] = useState({})

  async function logout() {
    await api.logout()
    await app.reload()
    app.showToast('로그아웃했어요.')
    navigate('/')
  }

  const asideRef = useRef(null)
  useEffect(() => {
    if (asideRef.current) asideRef.current.inert = !open
  }, [open])

  const roots = app.categories.filter((c) => !c.parent_id)
  const children = (id) => app.categories.filter((c) => c.parent_id === id)
  const links = (site.links || []).filter((l) => l.url && l.url !== '#')

  return (
    <aside ref={asideRef} className={`drawer ${open ? 'open' : ''}`} aria-label="메뉴">
      <div className="drawer-head">
        <span className="drawer-title">MENU</span>
        <div className="drawer-head-actions">
          {app.theme.allowToggle !== false && (
            <button type="button" className="icon-btn" onClick={app.toggleMode} aria-label={app.mode === 'dark' ? '라이트 모드로' : '다크 모드로'} title={app.mode === 'dark' ? '라이트 모드' : '다크 모드'}>
              <i className={`fa-solid ${app.mode === 'dark' ? 'fa-sun' : 'fa-moon'}`} />
            </button>
          )}
          <button type="button" className="icon-btn" onClick={onClose} aria-label="메뉴 닫기">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      </div>
      <div className="drawer-scroll">
        <div className="drawer-section">
          <form
            className="search-field"
            onSubmit={(e) => {
              e.preventDefault()
              if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`)
            }}
          >
            <i className="fa-solid fa-magnifying-glass" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="검색어 입력..." aria-label="검색어" />
          </form>
        </div>

        <div className="drawer-section">
          <span className="section-label">MENU</span>
          <nav className="drawer-tiles">
            {[
              { href: '/', icon: 'fa-solid fa-house', label: '홈', show: true },
              { href: '/notice', icon: 'fa-solid fa-bullhorn', label: '공지', show: site.menu.notice },
              { href: '/guestbook', icon: 'fa-solid fa-comment-dots', label: '방명록', show: site.menu.guestbook && site.features.guestbook !== false },
              { href: '/calendar', icon: 'fa-regular fa-calendar', label: '캘린더', show: site.menu.calendar },
              { href: '/tags', icon: 'fa-solid fa-hashtag', label: '태그', show: site.menu.tags },
              { href: '/banners', icon: 'fa-solid fa-flag', label: '배너', show: site.menu.banners },
            ]
              .filter((t) => t.show)
              .map((t) => (
                <a key={t.href} href={t.href} className="drawer-tile">
                  <span className="drawer-tile-icon">
                    <i className={t.icon} />
                  </span>
                  <span>{t.label}</span>
                </a>
              ))}
          </nav>
        </div>

        <div className="drawer-section">
          <span className="section-label">CATEGORY</span>
          <nav className="drawer-cats">
            {site.menu.archive && (
              <a href="/archive" className="cat-link">
                <i className="cat-icon fa-solid fa-layer-group" />
                <span>전체 기록</span>
                <span className="cat-count">{app.stats.posts || 0}</span>
              </a>
            )}
            {roots.map((c) => {
              const kids = children(c.id)
              const isOpen = openCats[c.id]
              return (
                <div key={c.id} className={`cat-item ${isOpen ? 'open' : ''}`}>
                  <a href={`/category/${encodeURIComponent(c.slug)}`} className="cat-link">
                    <i className={`cat-icon ${c.icon || 'fa-solid fa-folder'}`} />
                    <span>{c.name}</span>
                    {isRecent(c.latest) && <span className="new-badge">N</span>}
                    <span className="cat-count">{c.count + kids.reduce((s, k) => s + k.count, 0)}</span>
                  </a>
                  {kids.length > 0 && (
                    <>
                      <button
                        type="button"
                        className="cat-toggle"
                        onClick={() => setOpenCats((s) => ({ ...s, [c.id]: !s[c.id] }))}
                        aria-label={`${c.name} 하위 카테고리 ${isOpen ? '접기' : '펼치기'}`}
                        aria-expanded={!!isOpen}
                      >
                        <i className="fa-solid fa-chevron-right" />
                      </button>
                      <div className="cat-children">
                        {kids.map((k) => (
                          <a key={k.id} href={`/category/${encodeURIComponent(k.slug)}`} className="cat-link sub">
                            <i className={`cat-icon ${k.icon || 'fa-regular fa-folder'}`} />
                            <span>{k.name}</span>
                            {isRecent(k.latest) && <span className="new-badge">N</span>}
                            <span className="cat-count">{k.count}</span>
                          </a>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
            {!roots.length && app.admin && (
              <a href="/admin/categories" className="cat-link muted">
                <i className="cat-icon fa-solid fa-plus" />
                <span>카테고리 만들기</span>
              </a>
            )}
          </nav>
        </div>

        {links.length > 0 && (
          <div className="drawer-section">
            <span className="section-label">LINK</span>
            <div className="drawer-links">
              {links.map((l, i) => (
                <a key={i} href={l.url} target="_blank" rel="noopener noreferrer">
                  <i className={l.icon || 'fa-solid fa-link'} />
                  {l.name}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="drawer-foot">
        <div className="drawer-account">
          {app.admin ? (
            <>
              <a href="/write">
                <i className="fa-solid fa-pen" /> 글쓰기
              </a>
              <a href="/admin">
                <i className="fa-solid fa-gear" /> 관리
              </a>
              <button type="button" onClick={logout}>
                <i className="fa-solid fa-right-from-bracket" /> 로그아웃
              </button>
            </>
          ) : (
            <a href="/login">
              <i className="fa-solid fa-right-to-bracket" /> 로그인
            </a>
          )}
        </div>
        <BgmCard />
      </div>
    </aside>
  )
}

export function bottomNavItems(app) {
  const list = Array.isArray(app.theme.bottomNav) ? app.theme.bottomNav : app.site.bottomNav || []
  return list.filter((it) => it && it.href && (!it.adminOnly || app.admin)).slice(0, 6)
}

function BottomNav({ path }) {
  const app = useApp()
  const items = bottomNavItems(app)
  const ref = useRef(null)
  // 저장 바·글쓰기 바·버튼들이 하단 탭 바로 위에 뜰 수 있게 높이를 알려줘요.
  useEffect(() => {
    const el = ref.current
    const root = document.documentElement
    if (!el) {
      root.style.removeProperty('--bottom-nav-space')
      return
    }
    const update = () => root.style.setProperty('--bottom-nav-space', `${el.offsetHeight + 26}px`)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      ro.disconnect()
      root.style.removeProperty('--bottom-nav-space')
    }
  }, [items.length])
  if (!items.length) return null
  return (
    <nav className="bottom-nav" aria-label="하단 메뉴" ref={ref}>
      {items.map((item, i) => {
        const active = item.href === '/' ? path === '/' : path.startsWith(item.href)
        return (
          <a key={i} href={item.href} className={active ? 'active' : ''}>
            <i className={item.icon || 'fa-solid fa-circle'} />
            <span>{item.label}</span>
          </a>
        )
      })}
    </nav>
  )
}

function Footer() {
  const { site } = useApp()
  return (
    <footer className="site-footer">
      <span>{site.footer || 'ODAN DREAMPAIR'}</span>
    </footer>
  )
}

/* One UI 인터넷 앱 느낌의 본문 창. 주소줄에 메뉴·검색·모드·글쓰기 버튼이 함께 들어가요. */
function BrowserFrame({ path, showUrl, onMenu, children }) {
  const app = useApp()
  const url = `${window.location.host}${decodeURIComponent(path)}`
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      app.showToast('주소를 복사했어요.')
    } catch {
      window.prompt('주소', window.location.href)
    }
  }
  return (
    <div className="browser-frame">
      <div className={`browser-bar ${showUrl ? '' : 'no-url'}`}>
        {onMenu ? (
          <button type="button" className="browser-btn" onClick={onMenu} aria-label="메뉴 열기">
            <i className="fa-solid fa-bars" />
          </button>
        ) : (
          <a href="/" className="browser-btn" aria-label="홈">
            <i className="fa-solid fa-house" />
          </a>
        )}
        {showUrl && (
          <button type="button" className="browser-btn back" onClick={() => window.history.back()} aria-label="뒤로" disabled={path === '/'}>
            <i className="fa-solid fa-arrow-left" />
          </button>
        )}
        {showUrl ? (
          <button type="button" className="browser-url" onClick={copy} title="주소 복사">
            <i className="fa-solid fa-lock" />
            <span>{url}</span>
          </button>
        ) : (
          <span className="browser-spacer" />
        )}
        <a href="/search" className="browser-btn" aria-label="검색">
          <i className="fa-solid fa-magnifying-glass" />
        </a>
        {app.theme.allowToggle !== false && (
          <button type="button" className="browser-btn" onClick={app.toggleMode} aria-label={app.mode === 'dark' ? '라이트 모드로' : '다크 모드로'}>
            <i className={`fa-solid ${app.mode === 'dark' ? 'fa-sun' : 'fa-moon'}`} />
          </button>
        )}
        {app.admin && (
          <a href="/write" className="browser-btn accent" aria-label="글쓰기">
            <i className="fa-solid fa-pen" />
          </a>
        )}
      </div>
      <div className="browser-body">{children}</div>
    </div>
  )
}

// 스크롤바 대신 쓰는 '맨 위로' 버튼. 조금 내려가면 창 오른쪽 아래에 나타나요. (휴대폰에서는 숨김)
function ScrollTopButton() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const on = () => setShow(scrollTop() > 320)
    on()
    // 사이트 배경 이미지를 쓸 때는 #root가 스크롤되므로, 캡처 단계로 모든 스크롤을 들어요.
    window.addEventListener('scroll', on, { capture: true, passive: true })
    return () => window.removeEventListener('scroll', on, { capture: true })
  }, [])
  return (
    <button
      type="button"
      className={`scroll-top-btn ${show ? 'show' : ''}`}
      onClick={() => {
        const el = scrollRoot()
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        ;(el || window).scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
      }}
      aria-label="맨 위로"
      title="맨 위로"
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
    >
      <i className="fa-solid fa-arrow-up" />
    </button>
  )
}
