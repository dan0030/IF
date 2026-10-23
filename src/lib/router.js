import { useEffect, useState } from 'react'

// 라이브러리 없이 쓰는 아주 작은 라우터입니다.
const listeners = new Set()

// 배경이 사진·패턴·그라데이션이면 페이지가 #root 안에서 스크롤돼요. (스크롤바 뒤로 배경이 비쳐 보이게)
export function scrollRoot() {
  return document.documentElement.classList.contains('inner-scroll') ? document.getElementById('root') : null
}

export function scrollTop() {
  return scrollRoot()?.scrollTop ?? window.scrollY
}

export function scrollToTop() {
  const el = scrollRoot()
  if (el) el.scrollTo({ top: 0 })
  else window.scrollTo({ top: 0 })
}

function current() {
  return { path: window.location.pathname, search: window.location.search, hash: window.location.hash }
}

export function navigate(to, { replace = false, keepScroll = false } = {}) {
  const target = new URL(to, window.location.origin)
  const same = target.pathname + target.search === window.location.pathname + window.location.search
  if (replace) window.history.replaceState({}, '', target.pathname + target.search + target.hash)
  else window.history.pushState({}, '', target.pathname + target.search + target.hash)
  listeners.forEach((fn) => fn())
  if (!keepScroll && !same) scrollToTop()
}

window.addEventListener('popstate', () => listeners.forEach((fn) => fn()))

// 사이트 안쪽 링크(<a href="/...">)는 전부 새로고침 없이 이동합니다.
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  const a = e.target.closest?.('a[href]')
  if (!a || a.target === '_blank' || a.hasAttribute('download') || a.dataset.native !== undefined) return
  const href = a.getAttribute('href')
  if (!href || href.startsWith('#') || href.startsWith('/api/') || href.startsWith('/files/')) return
  const url = new URL(href, window.location.href)
  if (url.origin !== window.location.origin) return
  e.preventDefault()
  navigate(url.pathname + url.search + url.hash)
})

export function useLocation() {
  const [loc, setLoc] = useState(current)
  useEffect(() => {
    const fn = () => setLoc(current())
    listeners.add(fn)
    return () => listeners.delete(fn)
  }, [])
  return loc
}

export function matchRoute(path) {
  const routes = [
    ['home', /^\/$/],
    ['archive', /^\/archive$/],
    ['category', /^\/category\/([^/]+)$/],
    ['tag', /^\/tag\/([^/]+)$/],
    ['tags', /^\/tags$/],
    ['search', /^\/search$/],
    ['post', /^\/post\/(\d+)$/],
    ['notice', /^\/notice$/],
    ['guestbook', /^\/guestbook$/],
    ['calendar', /^\/calendar$/],
    ['banners', /^\/banners$/],
    ['login', /^\/login$/],
    ['write', /^\/write(?:\/(\d+))?$/],
    ['admin', /^\/admin(?:\/([\w-]+))?$/],
  ]
  for (const [name, re] of routes) {
    const m = path.match(re)
    if (m) return { name, params: m.slice(1).map((v) => (v ? decodeURIComponent(v) : v)) }
  }
  return { name: 'notfound', params: [] }
}
