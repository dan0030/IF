import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './api.js'
import { resolveHome, resolveSite, resolveTheme } from './defaults.js'
import { orderCategories } from './categories.js'
import { applyTheme, resolveMode, setFavicon } from './theme.js'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [previewTheme, setPreviewTheme] = useState(null) // 디자인 편집 중 미리보기
  const [modeOverride, setModeOverride] = useState(null)
  const [toast, setToast] = useState(null)
  const [, bumpSystemMode] = useState(0)

  const load = useCallback(async () => {
    try {
      const res = await api.bootstrap()
      setData(res)
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const site = useMemo(() => resolveSite(data?.site), [data?.site])
  const savedTheme = useMemo(() => resolveTheme(data?.theme), [data?.theme])
  const theme = previewTheme || savedTheme
  const home = useMemo(() => resolveHome(data?.home), [data?.home])
  // 글쓰기·관리 등 모든 곳에서 메뉴와 같은 순서(상위 아래 하위)로 보여줘요
  const orderedCategories = useMemo(() => orderCategories(data?.categories || []), [data?.categories])
  const mode = modeOverride || resolveMode(theme)

  useEffect(() => {
    applyTheme(theme, mode)
  }, [theme, mode])

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const fn = () => bumpSystemMode((n) => n + 1)
    mq.addEventListener?.('change', fn)
    return () => mq.removeEventListener?.('change', fn)
  }, [])

  useEffect(() => {
    setFavicon(site.favicon)
  }, [site.favicon])

  // 라이트/다크 전환: 누른 자리에서 원이 퍼지듯 바뀌고, 지원하지 않는 브라우저에서는 색이 부드럽게 섞여요.
  const toggleMode = useCallback(
    (event) => {
      const next = mode === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem('od-mode', next)
      } catch {
        // 무시
      }
      const root = document.documentElement
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || theme.animations === false
      const switchNow = () => {
        applyTheme(theme, next)
        setModeOverride(next)
      }
      if (reduce) {
        switchNow()
        return
      }
      if (document.startViewTransition) {
        const rect = event?.currentTarget?.getBoundingClientRect?.()
        const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
        const y = rect ? rect.top + rect.height / 2 : 0
        const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
        root.classList.add('mode-reveal')
        const vt = document.startViewTransition(switchNow)
        vt.ready
          .then(() => {
            root.animate(
              { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
              { duration: 550, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' },
            )
          })
          .catch(() => {})
        vt.finished.finally(() => root.classList.remove('mode-reveal'))
        return
      }
      root.classList.add('mode-fade')
      switchNow()
      setTimeout(() => root.classList.remove('mode-fade'), 600)
    },
    [mode, theme],
  )

  const saveSetting = useCallback(async (key, value) => {
    await api.saveSetting(key, value)
    setData((d) => ({ ...d, [key]: value }))
  }, [])

  const setCategories = useCallback((categories) => setData((d) => ({ ...d, categories })), [])

  const showToast = useCallback((message) => {
    setToast({ message, id: Date.now() })
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  const value = {
    ready: !!data,
    error,
    reload: load,
    admin: !!data?.admin,
    site,
    rawSite: data?.site,
    theme,
    savedTheme,
    rawTheme: data?.theme,
    setPreviewTheme,
    home,
    categories: orderedCategories,
    setCategories,
    stats: data?.stats || {},
    mode,
    toggleMode,
    saveSetting,
    toast,
    showToast,
  }
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  return useContext(AppContext)
}

// 이름 변환: 글 속 {{나}} {{상대}} {{페어}} 를 프로필 이름으로 바꿉니다.
export function swapNames(html, site) {
  if (!html || site.features?.nameSwap === false) return html
  return html
    .replace(/\{\{\s*나\s*\}\}/g, escapeText(site.pair.me.name))
    .replace(/\{\{\s*상대\s*\}\}/g, escapeText(site.pair.partner.name))
    .replace(/\{\{\s*페어\s*\}\}/g, escapeText(site.pair.pairName))
}

function escapeText(s) {
  return String(s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
}
