import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { LargeTitle, useTopbarTitle } from '../components/Shell.jsx'
import { scrollTop } from '../lib/router.js'
import { Sheet, Switch } from '../components/ui.jsx'
import { Fields } from '../components/Fields.jsx'
import { COMMON_WIDGET_FIELDS, WIDGETS } from '../widgets/index.jsx'
import { DEFAULT_HOME } from '../lib/defaults.js'
import { uid } from '../lib/format.js'
import { IN_PREVIEW, hasMobileLayout, useIsMobile } from '../lib/device.js'
import { PhonePreview } from './HomePreview.jsx'

const SIZE_LABEL = { S: '작게', M: '중간', L: '크게' }

// 홈 격자는 12칸이에요. S=3칸(25%), M=6칸(50%), L=12칸(100%)이고, 너비를 직접 고르면 widget.span이 우선해요.
const SIZE_SPAN = { S: 3, M: 6, L: 12 }
export const WIDTH_STEPS = [
  { span: 3, label: '25%' },
  { span: 4, label: '33%' },
  { span: 6, label: '50%' },
  { span: 8, label: '66%' },
  { span: 9, label: '75%' },
  { span: 12, label: '100%' },
]
export function spanOf(w) {
  return Number(w.span) || SIZE_SPAN[w.size || 'L'] || 12
}
// 위젯 안쪽 모양(아이콘형·세로 배치 등)은 실제 너비에 맞춰 S/M/L로 알려줘요.
export function sizeOf(w) {
  if (!w.span) return w.size || 'L'
  const s = spanOf(w)
  return s <= 3 ? 'S' : s <= 8 ? 'M' : 'L'
}
function widthLabel(w) {
  return WIDTH_STEPS.find((x) => x.span === spanOf(w))?.label || `${Math.round((spanOf(w) / 12) * 100)}%`
}

export default function Home() {
  const app = useApp()
  const { site, theme } = app
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [previewHome, setPreviewHome] = useState(null)
  const isMobile = useIsMobile()
  const source = IN_PREVIEW && previewHome ? previewHome : editing ? draft : app.home
  // 모바일 화면에서는 '모바일 홈 화면'을 따로 만들어 켜두었다면 그걸 보여줘요.
  const layoutKey = isMobile && hasMobileLayout(source) ? 'mobile' : 'pc'
  const home = layoutKey === 'mobile' ? source.mobile : source

  // 미리보기 창 안에서는 편집 중인(저장 전) 홈 화면을 부모 창에서 받아 그려요.
  useEffect(() => {
    if (!IN_PREVIEW) return
    const onMsg = (e) => {
      if (e.origin !== window.location.origin || e.source !== window.parent) return
      if (e.data?.type === 'od-home-preview') setPreviewHome(e.data.home)
    }
    window.addEventListener('message', onMsg)
    window.parent.postMessage({ type: 'od-preview-ready' }, window.location.origin)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  useTopbarTitle(theme.homeTitle ? undefined : site.title)

  // 휴대폰 홈 화면처럼 스크롤 없이 한 화면 안에 배치해요. (편집 중이거나 '아래로 이어보기'일 땐 스크롤 가능)
  const fixed = theme.homeLayout !== 'stack' && theme.homeFixed !== false && !editing
  useEffect(() => {
    document.documentElement.classList.toggle('home-fixed', fixed)
    return () => document.documentElement.classList.remove('home-fixed')
  }, [fixed])

  useEffect(() => {
    document.title = site.title
  }, [site.title])

  function startEdit() {
    setDraft(JSON.parse(JSON.stringify(app.home)))
    setEditing(true)
  }

  async function saveDraft() {
    try {
      await app.saveSetting('home', draft)
      app.showToast('홈 화면을 저장했어요.')
      setEditing(false)
    } catch (e) {
      app.showToast(e.message)
    }
  }

  // 투두 체크처럼 홈 화면에서 바로 바뀌는 설정은 즉시 저장합니다.
  const quickUpdate = useCallback(
    async (pageIdx, widgetIdx, config) => {
      const next = JSON.parse(JSON.stringify(app.home))
      const target = layoutKey === 'mobile' ? next.mobile : next
      target.pages[pageIdx].widgets[widgetIdx].config = config
      try {
        await app.saveSetting('home', next)
      } catch (e) {
        app.showToast(e.message)
      }
    },
    [app, layoutKey],
  )

  return (
    <div className={`home ${editing ? 'editing' : ''} ${fixed ? 'fixed' : ''}`}>
      {theme.homeTitle && !editing && (
        <LargeTitle
          title={site.title}
          subtitle={site.description}
          className={`home-title bd-${theme.homeTitleBg || 'none'}`}
          style={theme.homeTitleBg === 'image' && theme.homeTitleImage ? { '--home-title-image': `url("${theme.homeTitleImage}")`, '--home-title-dim': theme.homeTitleDim ?? 0.35 } : undefined}
        />
      )}
      {editing ? (
        <HomeEditor draft={draft} setDraft={setDraft} startTarget={layoutKey} onCancel={() => setEditing(false)} onSave={saveDraft} />
      ) : (
        <HomePages key={layoutKey} home={home} layout={theme.homeLayout} dots={theme.dots} dotsPosition={theme.dotsPosition} onQuickUpdate={app.admin && !IN_PREVIEW ? quickUpdate : null} fixed={fixed} admin={app.admin && !isMobile} align={theme.homeAlign || 'top'} />
      )}
      {app.admin && !editing && !IN_PREVIEW && (
        <button type="button" className="fab" onClick={startEdit} aria-label="홈 화면 편집">
          <i className="fa-solid fa-pen-to-square" />
          <span>홈 편집</span>
        </button>
      )}
    </div>
  )
}

function HomePages({ home, layout, dots, dotsPosition, onQuickUpdate, fixed, admin, align = 'top' }) {
  const pages = home.pages
  const ref = useRef(null)
  const swipeRef = useRef(null)
  const [active, setActive] = useState(0)
  const [height, setHeight] = useState(null)
  const [overflowing, setOverflowing] = useState([])
  const [hintClosed, setHintClosed] = useState(false)
  const drag = useRef(null)

  // 창 높이에서 위쪽(상단바·제목)과 아래쪽(하단 탭)을 뺀 만큼을 홈 화면 높이로 써요.
  useEffect(() => {
    if (!fixed) {
      setHeight(null)
      return
    }
    const measure = () => {
      const el = swipeRef.current
      if (!el) return
      const top = el.getBoundingClientRect().top + scrollTop()
      const bottomSpace = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bottom-nav-space')) || 12
      setHeight(Math.max(240, Math.floor(window.innerHeight - top - bottomSpace)))
    }
    measure()
    const t = setTimeout(measure, 400)
    window.addEventListener('resize', measure)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', measure)
    }
  }, [fixed])

  // 관리자에게는 화면보다 길어서 아래가 잘리는 페이지를 알려줘요.
  useEffect(() => {
    if (!fixed || !admin || !height) return
    const t = setTimeout(() => {
      const els = ref.current?.querySelectorAll('.home-page') || []
      setOverflowing([...els].map((el) => el.scrollHeight > el.clientHeight + 4))
    }, 600)
    return () => clearTimeout(t)
  }, [fixed, admin, height, home])

  useEffect(() => {
    const saved = Number(sessionStorage.getItem('od-home-page') || 0)
    if (saved && ref.current && saved < pages.length) {
      ref.current.scrollLeft = saved * ref.current.clientWidth
      setActive(saved)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onScroll() {
    const el = ref.current
    if (!el) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    if (i !== active) {
      setActive(i)
      try {
        sessionStorage.setItem('od-home-page', String(i))
      } catch {
        // 무시
      }
    }
  }

  function goTo(i) {
    const el = ref.current
    if (!el) return
    const target = Math.max(0, Math.min(pages.length - 1, i))
    el.scrollTo({ left: target * el.clientWidth, behavior: 'smooth' })
  }

  // 마우스로도 옆으로 끌어서 넘길 수 있게 합니다.
  function onPointerDown(e) {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    if (e.target.closest('a, button, input, label, iframe, .slides-widget, textarea, select')) return
    drag.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false }
    ref.current.classList.add('dragging')
  }
  function onPointerMove(e) {
    if (!drag.current) return
    const dx = e.clientX - drag.current.x
    if (Math.abs(dx) > 3) drag.current.moved = true
    ref.current.scrollLeft = drag.current.left - dx
  }
  function onPointerUp() {
    if (!drag.current) return
    const el = ref.current
    el.classList.remove('dragging')
    const dx = el.scrollLeft - drag.current.left
    const base = Math.round(drag.current.left / el.clientWidth)
    drag.current = null
    goTo(Math.abs(dx) > el.clientWidth * 0.15 ? base + Math.sign(dx) : base)
  }

  if (layout === 'stack' || pages.length === 1) {
    return (
      <div className="home-stack">
        {pages.map((page, pi) => (
          <WidgetGrid key={page.id} page={page} pageIdx={pi} onQuickUpdate={onQuickUpdate} />
        ))}
      </div>
    )
  }

  const indicator = dots !== 'none' && (
    <PageDots style={dots} count={pages.length} active={active} onSelect={goTo} />
  )

  return (
    <div className={`home-swipe ${fixed ? 'fixed' : ''}`} ref={swipeRef} style={height ? { height } : undefined}>
      {dotsPosition === 'top' && indicator}
      <div
        className="home-pages"
        ref={ref}
        onScroll={onScroll}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        tabIndex={0}
        aria-roledescription="홈 화면 페이지"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') goTo(active + 1)
          if (e.key === 'ArrowLeft') goTo(active - 1)
        }}
      >
        {pages.map((page, pi) => (
          <section className={`home-page align-${page.align || align}`} key={page.id} aria-label={`${pi + 1}페이지`} aria-hidden={pi !== active}>
            <WidgetGrid page={page} pageIdx={pi} onQuickUpdate={onQuickUpdate} />
            {overflowing[pi] && !hintClosed && (
              <div className="page-overflow-hint">
                <i className="fa-solid fa-triangle-exclamation" />
                <span>이 페이지는 화면보다 길어서 아래가 잘려 보여요. 위젯을 줄이거나 다른 페이지로 옮겨주세요. (관리자에게만 보여요)</span>
                <button type="button" onClick={() => setHintClosed(true)} aria-label="알림 닫기">
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
            )}
          </section>
        ))}
      </div>
      <button type="button" className="page-arrow prev" onClick={() => goTo(active - 1)} disabled={active === 0} aria-label="이전 페이지">
        <i className="fa-solid fa-chevron-left" />
      </button>
      <button type="button" className="page-arrow next" onClick={() => goTo(active + 1)} disabled={active === pages.length - 1} aria-label="다음 페이지">
        <i className="fa-solid fa-chevron-right" />
      </button>
      {dotsPosition !== 'top' && indicator}
    </div>
  )
}

export function PageDots({ style, count, active, onSelect }) {
  if (style === 'number') {
    return (
      <div className="page-dots number" aria-live="polite">
        <button type="button" onClick={() => onSelect(active - 1)} aria-label="이전 페이지">
          <i className="fa-solid fa-chevron-left" />
        </button>
        <span>
          {active + 1} / {count}
        </span>
        <button type="button" onClick={() => onSelect(active + 1)} aria-label="다음 페이지">
          <i className="fa-solid fa-chevron-right" />
        </button>
      </div>
    )
  }
  return (
    <div className={`page-dots ${style}`} role="tablist">
      {Array.from({ length: count }, (_, i) => (
        <button
          type="button"
          key={i}
          role="tab"
          aria-selected={i === active}
          aria-label={`${i + 1}페이지`}
          className={i === active ? 'active' : ''}
          onClick={() => onSelect(i)}
        />
      ))}
    </div>
  )
}

function widgetStyle(config) {
  const style = {}
  if (config.bg) style['--w-bg'] = config.bg
  if (config.color) style['--w-color'] = config.color
  if (config.bgImage) style['--w-image'] = `url("${config.bgImage}")`
  return style
}

export function WidgetFrame({ widget, children, editing }) {
  const def = WIDGETS[widget.type]
  const config = widget.config || {}
  const styleName = config.style || (def?.bare ? 'bare' : 'card')
  const h = Number(widget.height) || 0
  const style = { ...widgetStyle(config), gridColumn: `span ${spanOf(widget)}` }
  if (h) style['--w-height'] = `${h}px`
  return (
    <div
      className={`widget w-${widget.type} size-${sizeOf(widget)} style-${styleName} ${h ? 'fixed-h' : ''} ${config.bgImage ? 'has-bg-image' : ''} ${config.align === 'center' ? 'align-center' : ''} ${editing ? 'is-editing' : ''}`}
      style={style}
    >
      {children}
    </div>
  )
}

function WidgetGrid({ page, pageIdx, onQuickUpdate }) {
  return (
    <div className="widget-grid">
      {page.widgets.map((w, wi) => {
        const def = WIDGETS[w.type]
        if (!def) return null
        const C = def.Component
        return (
          <WidgetFrame key={w.id} widget={w}>
            <C config={{ ...def.defaults, ...w.config }} size={sizeOf(w)} onConfigChange={onQuickUpdate ? (c) => onQuickUpdate(pageIdx, wi, c) : null} />
          </WidgetFrame>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 홈 화면 편집                                                          */
/* ------------------------------------------------------------------ */

// 다른 배치로 복사할 때 위젯·페이지 id를 새로 붙여요.
function cloneLayout(pages) {
  return JSON.parse(JSON.stringify(pages || [])).map((p) => ({ ...p, id: uid('page'), widgets: (p.widgets || []).map((w) => ({ ...w, id: uid('w') })) }))
}

function HomeEditor({ draft, setDraft, startTarget = 'pc', onCancel, onSave }) {
  const [picker, setPicker] = useState(null) // 위젯을 추가할 페이지 번호
  const [editingWidget, setEditingWidget] = useState(null) // { pageIdx, widgetIdx }
  const [dragFrom, setDragFrom] = useState(null)
  // 'pc' = 기본(PC·태블릿) 홈 화면, 'mobile' = 휴대폰에서만 보이는 홈 화면
  const [target, setTarget] = useState(startTarget)
  const [preview, setPreview] = useState(() => {
    try {
      const saved = localStorage.getItem('od-phone-preview')
      return saved ? saved === '1' : window.innerWidth >= 1280
    } catch {
      return window.innerWidth >= 1280
    }
  })
  const togglePreview = () =>
    setPreview((v) => {
      try {
        localStorage.setItem('od-phone-preview', v ? '0' : '1')
      } catch {
        // 무시
      }
      return !v
    })

  const mobileReady = !!draft.mobile?.pages
  const layout = target === 'mobile' ? draft.mobile : draft

  // fn(배치, 전체) — 지금 편집 중인 배치(PC 또는 모바일)의 pages를 고쳐요.
  const update = (fn) =>
    setDraft((d) => {
      const next = JSON.parse(JSON.stringify(d))
      fn(target === 'mobile' ? next.mobile : next, next)
      return next
    })
  const updateAll = (fn) =>
    setDraft((d) => {
      const next = JSON.parse(JSON.stringify(d))
      fn(next)
      return next
    })

  function switchTarget(t) {
    setTarget(t)
    setEditingWidget(null)
    setPicker(null)
    setDragFrom(null)
  }

  function moveWidget(from, to) {
    update((d) => {
      const [w] = d.pages[from.pageIdx].widgets.splice(from.widgetIdx, 1)
      let idx = to.widgetIdx
      if (from.pageIdx === to.pageIdx && from.widgetIdx < to.widgetIdx) idx -= 1
      d.pages[to.pageIdx].widgets.splice(Math.max(0, idx), 0, w)
    })
  }

  function addWidget(pageIdx, type) {
    const def = WIDGETS[type]
    const w = { id: uid('w'), type, size: def.sizes.includes('L') ? 'L' : def.sizes[def.sizes.length - 1], config: JSON.parse(JSON.stringify(def.defaults || {})) }
    if (type === 'shortcut') w.size = 'S'
    update((d) => d.pages[pageIdx].widgets.push(w))
    setPicker(null)
    setEditingWidget({ pageIdx, widgetIdx: layout.pages[pageIdx].widgets.length })
  }

  const current = layout && editingWidget && layout.pages[editingWidget.pageIdx]?.widgets[editingWidget.widgetIdx]

  return (
    <div className="home-editor">
      <div className="edit-bar">
        <div>
          <strong>홈 화면 편집</strong>
          <span>위젯을 끌어서 옮기거나, 버튼으로 순서·크기를 바꿔보세요.</span>
        </div>
        <div className="segmented small home-target-pick" role="radiogroup" aria-label="편집할 홈 화면">
          {[
            ['pc', 'PC', 'fa-solid fa-desktop'],
            ['mobile', '모바일', 'fa-solid fa-mobile-screen-button'],
          ].map(([v, label, icon]) => (
            <button type="button" key={v} role="radio" aria-checked={target === v} className={target === v ? 'active' : ''} onClick={() => switchTarget(v)}>
              <i className={icon} /> {label}
              {v === 'mobile' && <em className={`target-state ${hasMobileLayout(draft) ? 'on' : ''}`}>{hasMobileLayout(draft) ? '따로' : 'PC와 같음'}</em>}
            </button>
          ))}
        </div>
        <div className="row gap-s">
          <button type="button" className={`btn small ${preview ? 'tonal' : 'ghost'}`} onClick={togglePreview} aria-pressed={preview} title="휴대폰 화면 미리보기">
            <i className="fa-solid fa-mobile-screen" /> 미리보기
          </button>
          <button
            type="button"
            className="btn small ghost"
            disabled={!layout}
            onClick={() => {
              if (target === 'mobile') {
                if (window.confirm('모바일 홈 화면을 지금의 PC 배치로 다시 맞출까요? (저장 전까지는 반영되지 않아요)')) updateAll((d) => (d.mobile.pages = cloneLayout(d.pages)))
              } else if (window.confirm('PC 홈 화면을 기본 배치로 되돌릴까요? 모바일 홈 화면은 그대로 둬요. (저장 전까지는 반영되지 않아요)')) {
                updateAll((d) => (d.pages = cloneLayout(DEFAULT_HOME.pages)))
              }
            }}
          >
            초기화
          </button>
          <button type="button" className="btn small" onClick={onCancel}>
            취소
          </button>
          <button type="button" className="btn small primary" onClick={onSave}>
            저장
          </button>
        </div>
      </div>

      {target === 'mobile' && !mobileReady ? (
        <div className="mobile-setup card">
          <span className="mobile-setup-icon">
            <i className="fa-solid fa-mobile-screen-button" />
          </span>
          <h3>휴대폰 전용 홈 화면</h3>
          <p>지금은 휴대폰에서도 PC 홈 화면이 그대로(좁게) 보여요. 휴대폰에서만 보일 배치를 따로 만들 수 있어요.</p>
          <div className="row gap-s wrap center">
            <button type="button" className="btn primary" onClick={() => updateAll((d) => (d.mobile = { enabled: true, pages: cloneLayout(d.pages) }))}>
              <i className="fa-solid fa-copy" /> PC 배치 복사해서 시작
            </button>
            <button type="button" className="btn" onClick={() => updateAll((d) => (d.mobile = { enabled: true, pages: [{ id: uid('page'), widgets: [] }] }))}>
              빈 화면으로 시작
            </button>
          </div>
        </div>
      ) : (
        <>
      {target === 'mobile' && (
        <div className="mobile-options card">
          <Switch
            checked={draft.mobile.enabled !== false}
            onChange={(v) => updateAll((d) => (d.mobile.enabled = v))}
            label="휴대폰에서 이 홈 화면 쓰기"
            description="끄면 휴대폰에서도 PC 홈 화면을 보여줘요. 만들어둔 배치는 지워지지 않아요."
          />
          <button
            type="button"
            className="btn small ghost danger"
            onClick={() => window.confirm('모바일 홈 화면을 지울까요? 휴대폰에서도 PC 홈 화면이 보여요. (저장 전까지는 반영되지 않아요)') && updateAll((d) => delete d.mobile)}
          >
            <i className="fa-solid fa-trash" /> 모바일 배치 지우기
          </button>
        </div>
      )}
      <div className={`edit-pages target-${target}`}>
      {layout.pages.map((page, pi) => (
        <section key={page.id} className="edit-page">
          <div className="edit-page-head">
            <span className="edit-page-name">{pi + 1}페이지</span>
            <div className="segmented small page-align-pick" role="radiogroup" aria-label={`${pi + 1}페이지 위젯 정렬`}>
              {[
                ['', '기본', 'fa-solid fa-rotate-left'],
                ['top', '위', 'fa-solid fa-arrow-up-long'],
                ['center', '가운데', 'fa-solid fa-arrows-up-down'],
                ['bottom', '아래', 'fa-solid fa-arrow-down-long'],
              ].map(([v, label, icon]) => (
                <button
                  type="button"
                  key={v || 'default'}
                  role="radio"
                  aria-checked={(page.align || '') === v}
                  className={(page.align || '') === v ? 'active' : ''}
                  title={v ? `위젯을 ${label}에 맞추기` : '디자인 설정(배치)을 따라요'}
                  onClick={() =>
                    update((d) => {
                      if (v) d.pages[pi].align = v
                      else delete d.pages[pi].align
                    })
                  }
                >
                  <i className={icon} /> {label}
                </button>
              ))}
            </div>
            <div className="row gap-xs">
              <button type="button" className="icon-btn small" disabled={pi === 0} onClick={() => update((d) => d.pages.splice(pi - 1, 0, d.pages.splice(pi, 1)[0]))} aria-label="페이지 앞으로">
                <i className="fa-solid fa-arrow-up" />
              </button>
              <button
                type="button"
                className="icon-btn small"
                disabled={pi === layout.pages.length - 1}
                onClick={() => update((d) => d.pages.splice(pi + 1, 0, d.pages.splice(pi, 1)[0]))}
                aria-label="페이지 뒤로"
              >
                <i className="fa-solid fa-arrow-down" />
              </button>
              <button
                type="button"
                className="icon-btn small danger"
                disabled={layout.pages.length === 1}
                onClick={() => window.confirm(`${pi + 1}페이지와 위젯을 모두 지울까요?`) && update((d) => d.pages.splice(pi, 1))}
                aria-label="페이지 삭제"
              >
                <i className="fa-solid fa-trash" />
              </button>
            </div>
          </div>
          <div
            className="widget-grid"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              if (e.target === e.currentTarget && dragFrom) moveWidget(dragFrom, { pageIdx: pi, widgetIdx: page.widgets.length })
              setDragFrom(null)
            }}
          >
            {page.widgets.map((w, wi) => {
              const def = WIDGETS[w.type]
              if (!def) return null
              const C = def.Component
              const sizes = def.sizes
              return (
                <div
                  key={w.id}
                  className={`edit-slot size-${sizeOf(w)} ${dragFrom?.pageIdx === pi && dragFrom?.widgetIdx === wi ? 'dragging' : ''}`}
                  style={{ gridColumn: `span ${spanOf(w)}` }}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move'
                    setDragFrom({ pageIdx: pi, widgetIdx: wi })
                  }}
                  onDragEnd={() => setDragFrom(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (dragFrom) moveWidget(dragFrom, { pageIdx: pi, widgetIdx: wi })
                    setDragFrom(null)
                  }}
                >
                  <WidgetFrame widget={w} editing>
                    <div className="edit-preview" inert="">
                      <C config={{ ...def.defaults, ...w.config }} size={sizeOf(w)} />
                    </div>
                  </WidgetFrame>
                  <div className="edit-tools">
                    <span className="edit-label">
                      <i className={def.icon} /> {def.label}
                    </span>
                    <div className="edit-buttons">
                      <button type="button" disabled={wi === 0} onClick={() => moveWidget({ pageIdx: pi, widgetIdx: wi }, { pageIdx: pi, widgetIdx: wi - 1 })} aria-label="앞으로">
                        <i className="fa-solid fa-arrow-left" />
                      </button>
                      <button
                        type="button"
                        disabled={wi === page.widgets.length - 1}
                        onClick={() => moveWidget({ pageIdx: pi, widgetIdx: wi }, { pageIdx: pi, widgetIdx: wi + 2 })}
                        aria-label="뒤로"
                      >
                        <i className="fa-solid fa-arrow-right" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          update((d) => {
                            const cur = spanOf(w)
                            const next = WIDTH_STEPS.find((x) => x.span > cur) || WIDTH_STEPS[0]
                            d.pages[pi].widgets[wi].span = next.span
                          })
                        }
                        aria-label="너비 바꾸기"
                        title="너비 바꾸기 (누를 때마다 넓어지고, 100% 다음은 25%)"
                      >
                        {widthLabel(w)}
                      </button>
                      <button type="button" onClick={() => setEditingWidget({ pageIdx: pi, widgetIdx: wi })} aria-label="설정">
                        <i className="fa-solid fa-sliders" />
                      </button>
                      <button type="button" className="danger" onClick={() => update((d) => d.pages[pi].widgets.splice(wi, 1))} aria-label="삭제">
                        <i className="fa-solid fa-trash" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
            <button type="button" className="add-widget size-L" onClick={() => setPicker(pi)}>
              <i className="fa-solid fa-plus" /> 위젯 추가
            </button>
          </div>
        </section>
      ))}

      </div>

      <button type="button" className="btn block" onClick={() => update((d) => d.pages.push({ id: uid('page'), widgets: [] }))}>
        <i className="fa-solid fa-plus" /> 페이지 추가
      </button>
        </>
      )}

      {preview && <PhonePreview home={draft} target={target} onClose={togglePreview} />}

      {picker !== null && (
        <Sheet title="위젯 추가" onClose={() => setPicker(null)} wide>
          <div className="widget-picker">
            {Object.entries(WIDGETS).map(([type, def]) => (
              <button type="button" key={type} onClick={() => addWidget(picker, type)}>
                <span className="widget-picker-icon">
                  <i className={def.icon} />
                </span>
                <span>{def.label}</span>
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {current && (
        <WidgetSettings
          widget={current}
          pageIdx={editingWidget.pageIdx}
          pageCount={layout.pages.length}
          onClose={() => setEditingWidget(null)}
          onChange={(w) => update((d) => (d.pages[editingWidget.pageIdx].widgets[editingWidget.widgetIdx] = w))}
          onMovePage={(to) => {
            moveWidget({ pageIdx: editingWidget.pageIdx, widgetIdx: editingWidget.widgetIdx }, { pageIdx: to, widgetIdx: layout.pages[to].widgets.length })
            setEditingWidget({ pageIdx: to, widgetIdx: layout.pages[to].widgets.length - (to === editingWidget.pageIdx ? 1 : 0) })
          }}
        />
      )}
    </div>
  )
}

function WidgetSettings({ widget, pageIdx, pageCount, onClose, onChange, onMovePage }) {
  const def = WIDGETS[widget.type]
  const config = { ...def.defaults, ...widget.config }
  return (
    <Sheet title={`${def.label} 설정`} onClose={onClose} wide footer={<button type="button" className="btn primary block" onClick={onClose}>완료</button>}>
      {def.help && <p className="sheet-help">{def.help}</p>}
      <div className="fields">
        <div className="field">
          <span className="field-label">너비</span>
          <div className="segmented">
            {WIDTH_STEPS.map((x) => (
              <button type="button" key={x.span} className={spanOf(widget) === x.span ? 'active' : ''} onClick={() => onChange({ ...widget, span: x.span })}>
                {x.label}
              </button>
            ))}
          </div>
          <p className="field-help">한 줄은 100%예요. 같은 줄에 놓을 위젯들의 너비 합이 100%가 되면 딱 맞아요.</p>
        </div>
        <div className="field">
          <span className="field-label">높이</span>
          <div className="range-row">
            <input
              type="range"
              min="0"
              max="800"
              step="10"
              value={Number(widget.height) || 0}
              onChange={(e) => onChange({ ...widget, height: Number(e.target.value) || 0 })}
              aria-label="위젯 높이"
            />
            <output>{Number(widget.height) ? `${widget.height}px` : '자동'}</output>
          </div>
          <div className="row gap-s wrap">
            {[0, 120, 180, 240, 320, 400].map((v) => (
              <button type="button" key={v} className={`chip ${(Number(widget.height) || 0) === v ? 'active' : ''}`} onClick={() => onChange({ ...widget, height: v })}>
                {v ? `${v}px` : '자동 (내용에 맞춤)'}
              </button>
            ))}
          </div>
          <p className="field-help">높이를 정하면 내용이 넘칠 때 위젯 안에서 스크롤돼요. 같은 줄 위젯들은 가장 높은 위젯에 맞춰 늘어나요.</p>
        </div>
        {pageCount > 1 && (
          <div className="field">
            <label className="field-label" htmlFor="widget-page">
              위치한 페이지
            </label>
            <select id="widget-page" value={pageIdx} onChange={(e) => onMovePage(Number(e.target.value))}>
              {Array.from({ length: pageCount }, (_, i) => (
                <option key={i} value={i}>
                  {i + 1}페이지
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <Fields fields={[...def.fields, ...COMMON_WIDGET_FIELDS]} value={config} onChange={(c) => onChange({ ...widget, config: c })} />
    </Sheet>
  )
}
