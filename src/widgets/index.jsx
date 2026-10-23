import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { api } from '../lib/api.js'
import { daysSince, ddayLabel, formatDate, nextAnnual, pad, parseDate, todayStr, youtubeId } from '../lib/format.js'
import { PostList } from '../components/PostList.jsx'
import { Content } from '../components/Content.jsx'
import { BgmCard } from '../components/Bgm.jsx'
import { LIST_STYLES } from '../lib/defaults.js'
import { BannerGrid } from '../pages/Banners.jsx'
import { DaySheet, eventOccurs, eventWhen } from '../components/CalendarEvents.jsx'

/* ------------------------------------------------------------------ */
/* 공용 훅                                                              */
/* ------------------------------------------------------------------ */

function usePosts(params, deps) {
  const [state, setState] = useState(null)
  useEffect(() => {
    let alive = true
    api
      .posts(params)
      .then((res) => alive && setState(res.items))
      .catch(() => alive && setState([]))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}

function WidgetTitle({ config, icon, fallback, children }) {
  if (config.hideTitle) return children ? <div className="widget-head no-title">{children}</div> : null
  const title = config.title ?? fallback
  if (!title && !children) return null
  return (
    <div className="widget-head">
      <h3 className="widget-title">
        {config.titleIcon || icon ? <i className={config.titleIcon || icon} /> : null}
        {title}
      </h3>
      {children}
    </div>
  )
}

function Placeholder({ icon, children }) {
  return (
    <div className="widget-placeholder">
      <i className={icon} />
      <span>{children}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 위젯들                                                               */
/* ------------------------------------------------------------------ */

function ProfileWidget({ config }) {
  const { site, stats } = useApp()
  const { pair } = site
  const mode = config.mode || 'pair'
  const layout = config.layout || 'row'
  const days = daysSince(pair.startDate)
  // 페어 순서: 기본은 '최애 × 나' (위젯 설정에서 '나 × 최애'로 바꿀 수 있어요)
  const [first, second] = config.order === 'me-first' ? [pair.me, pair.partner] : [pair.partner, pair.me]
  const Avatar = ({ who }) => (
    <div className="avatar" style={{ '--ring': who.color || 'var(--accent)' }}>
      {who.image ? <img src={who.image} alt={who.name} /> : <span>{(who.name || '?').slice(0, 1)}</span>}
    </div>
  )
  return (
    <div className={`profile-widget layout-${layout} mode-${mode}`}>
      {config.cover && <div className="profile-cover" style={{ backgroundImage: `url("${config.cover}")` }} />}
      <div className="profile-avatars">
        <Avatar who={mode === 'pair' ? first : mode === 'partner' ? pair.partner : pair.me} />
        {mode === 'pair' && (
          <>
            <span className="profile-symbol" style={{ color: pair.symbolColor || undefined, background: pair.symbolBg || undefined }}>
              <i className={pair.symbol || 'fa-solid fa-heart'} />
            </span>
            <Avatar who={second} />
          </>
        )}
      </div>
      <div className="profile-text">
        <strong className="profile-name">
          {mode === 'pair' ? pair.pairName || `${first.name} × ${second.name}` : mode === 'partner' ? pair.partner.name : pair.me.name}
        </strong>
        <span className="profile-sub">
          {mode === 'pair' ? [first.sub, second.sub].filter(Boolean).join(' · ') : mode === 'partner' ? pair.partner.sub : pair.me.sub}
        </span>
        {config.showBio !== false && pair.bio && <p className="profile-bio">{pair.bio}</p>}
      </div>
      {config.showStats !== false && (
        <div className="profile-stats">
          {pair.startDate && days !== null && (
            <div>
              <b>{days >= 0 ? days + 1 : `D${days}`}</b>
              <span>{pair.startLabel || '함께한 지'}</span>
            </div>
          )}
          <div>
            <b>{stats.posts || 0}</b>
            <span>기록</span>
          </div>
        </div>
      )}
    </div>
  )
}

function ShortcutWidget({ config, size }) {
  const external = /^https?:/.test(config.href || '')
  return (
    <a
      className={`shortcut-widget ${size === 'S' ? 'is-icon' : ''}`}
      href={config.href || '/'}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      style={config.iconBg ? { '--icon-bg': config.iconBg } : undefined}
    >
      <span className="shortcut-icon">{config.image ? <img src={config.image} alt="" /> : <i className={config.icon || 'fa-solid fa-star'} />}</span>
      <span className="shortcut-label">{config.label || '바로가기'}</span>
      {size !== 'S' && config.desc && <span className="shortcut-desc">{config.desc}</span>}
    </a>
  )
}

function DdayWidget({ config, size }) {
  const { site } = useApp()
  const items = config.items?.length ? config.items : [{ title: site.pair.startLabel || '함께한 지', date: '', mode: 'dplus' }]
  return (
    <div className={`dday-widget ${items.length > 1 ? 'multi' : ''}`}>
      {items.map((it, i) => {
        const date = it.date || site.pair.startDate
        let value = date ? ddayLabel(date, it.mode === 'dday' ? 'dday' : 'dplus') : 'D+?'
        if (it.mode === 'annual') {
          const n = nextAnnual(date)
          value = n === null ? 'D-?' : n === 0 ? 'D-DAY' : `D-${n}`
        }
        return (
          <div className="dday-item" key={i} style={it.image ? { '--dday-bg': `url("${it.image}")` } : undefined}>
            {it.image && <div className="dday-bg" />}
            <div className="dday-content">
              <span className="dday-icon">
                <i className={it.icon || 'fa-solid fa-heart'} />
              </span>
              <span className="dday-info">
                <span className="dday-title">{it.title}</span>
                <span className="dday-date">{date ? formatDate(date) : '관리 > 사이트에서 시작일을 정해주세요'}</span>
              </span>
              <strong className="dday-value">{value}</strong>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ClockWidget({ config }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * (config.seconds ? 1 : 15))
    return () => clearInterval(t)
  }, [config.seconds])
  const h = now.getHours()
  const hh = config.hour12 ? ((h + 11) % 12) + 1 : h
  const week = ['일', '월', '화', '수', '목', '금', '토'][now.getDay()]
  if (config.style === 'analog') {
    const deg = (v, max) => (v / max) * 360
    return (
      <div className="clock-widget analog">
        <div className="analog-face">
          {[...Array(12)].map((_, i) => (
            <span key={i} className="tick" style={{ transform: `rotate(${i * 30}deg)` }} />
          ))}
          <span className="hand hour" style={{ transform: `rotate(${deg((h % 12) + now.getMinutes() / 60, 12)}deg)` }} />
          <span className="hand minute" style={{ transform: `rotate(${deg(now.getMinutes(), 60)}deg)` }} />
          {config.seconds && <span className="hand second" style={{ transform: `rotate(${deg(now.getSeconds(), 60)}deg)` }} />}
        </div>
        <div className="clock-date">
          {now.getMonth() + 1}월 {now.getDate()}일 {week}요일
        </div>
      </div>
    )
  }
  return (
    <div className="clock-widget">
      <div className="clock-time">
        {pad(hh)}
        <span className="blink">:</span>
        {pad(now.getMinutes())}
        {config.seconds && <small>{pad(now.getSeconds())}</small>}
        {config.hour12 && <small>{h < 12 ? 'AM' : 'PM'}</small>}
      </div>
      <div className="clock-date">
        {now.getMonth() + 1}월 {now.getDate()}일 {week}요일
      </div>
      {config.label && <div className="clock-label">{config.label}</div>}
    </div>
  )
}

function RecentWidget({ config }) {
  const { theme } = useApp()
  const count = Number(config.count) || 4
  const items = usePosts({ limit: count, category: config.category, sort: config.sort || 'recent', pinned: config.sort === 'views' ? 0 : 1 }, [count, config.category, config.sort])
  return (
    <>
      <WidgetTitle config={config} fallback="최근 기록" icon="fa-solid fa-clock-rotate-left">
        <a className="widget-more" href={config.category ? `/category/${encodeURIComponent(config.category)}` : '/archive'}>
          더보기 <i className="fa-solid fa-chevron-right" />
        </a>
      </WidgetTitle>
      {items === null ? (
        <div className="skeleton" />
      ) : items.length ? (
        <PostList items={items} style={config.style || theme.listStyle} compact />
      ) : (
        <Placeholder icon="fa-regular fa-file-lines">아직 기록이 없어요</Placeholder>
      )}
    </>
  )
}

function PicksWidget({ config }) {
  const ids = (config.items || []).map((it) => it.post).filter(Boolean)
  const items = usePosts({ ids: ids.join(','), limit: 50, type: 'all' }, [ids.join(',')])
  return (
    <>
      <WidgetTitle config={config} fallback="추천 글" icon="fa-solid fa-fire" />
      {!ids.length ? (
        <Placeholder icon="fa-solid fa-fire">편집에서 글을 골라주세요</Placeholder>
      ) : items === null ? (
        <div className="skeleton" />
      ) : (
        <div className="picks-list">
          {items.map((p) => (
            <a key={p.id} href={`/post/${p.id}`} className="pick-item">
              {p.thumbnail && (
                <span className="pick-thumb">
                  <img src={p.thumbnail} alt="" loading="lazy" />
                </span>
              )}
              <span className="pick-info">
                <strong>{p.title}</strong>
                <span>{formatDate(p.publishedAt)}</span>
              </span>
            </a>
          ))}
        </div>
      )}
    </>
  )
}

function NoticeWidget({ config }) {
  const latest = usePosts({ type: 'notice', limit: Number(config.count) || 2 }, [config.count, config.source])
  const manual = config.source === 'manual'
  const items = manual ? config.items || [] : (latest || []).map((p) => ({ title: p.title, body: p.excerpt, href: `/post/${p.id}` }))
  return (
    <>
      <WidgetTitle config={config} fallback="" icon="fa-solid fa-bullhorn" />
      {!items.length ? (
        <Placeholder icon="fa-solid fa-bullhorn">{latest === null && !manual ? '불러오는 중' : '공지가 없어요'}</Placeholder>
      ) : (
        <div className="notice-list">
          {items.map((n, i) => (
            <a key={i} className="notice-item" href={n.href || '/notice'}>
              <strong>
                <i className="fa-solid fa-bullhorn" /> {n.title}
              </strong>
              {n.body && <p>{n.body}</p>}
            </a>
          ))}
        </div>
      )}
    </>
  )
}

function BannerWidget({ config }) {
  const items = (config.items || []).filter((it) => it.image)
  const [i, setI] = useState(0)
  useEffect(() => {
    if (items.length <= 1 || config.autoplay === false) return
    const t = setInterval(() => setI((v) => (v + 1) % items.length), (Number(config.interval) || 5) * 1000)
    return () => clearInterval(t)
  }, [items.length, config.autoplay, config.interval])
  if (!items.length) return <Placeholder icon="fa-regular fa-images">배너 이미지를 추가해주세요</Placeholder>
  const go = (d) => setI((v) => (v + d + items.length) % items.length)
  return (
    <div className="banner-widget" style={{ '--ratio': config.ratio || '3 / 1' }}>
      <div className="banner-track" style={{ transform: `translateX(-${i * 100}%)` }}>
        {items.map((it, j) => {
          const inner = (
            <>
              <img src={it.image} alt={it.caption || ''} />
              {it.caption && <span className="banner-caption">{it.caption}</span>}
            </>
          )
          return it.href ? (
            <a key={j} href={it.href} className="banner-slide">
              {inner}
            </a>
          ) : (
            <div key={j} className="banner-slide">
              {inner}
            </div>
          )
        })}
      </div>
      {items.length > 1 && (
        <>
          <button type="button" className="banner-btn prev" onClick={() => go(-1)} aria-label="이전 배너">
            <i className="fa-solid fa-chevron-left" />
          </button>
          <button type="button" className="banner-btn next" onClick={() => go(1)} aria-label="다음 배너">
            <i className="fa-solid fa-chevron-right" />
          </button>
          <div className="banner-dots">
            {items.map((_, j) => (
              <span key={j} className={j === i ? 'active' : ''} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function PlaylistWidget({ config }) {
  const [open, setOpen] = useState(null)
  const items = config.items || []
  return (
    <>
      <WidgetTitle config={config} fallback="플레이리스트" icon="fa-solid fa-music" />
      {!items.length ? (
        <Placeholder icon="fa-solid fa-music">곡을 추가해주세요</Placeholder>
      ) : (
        <div className="playlist">
          {items.map((it, i) => {
            const vid = youtubeId(it.url)
            const isOpen = open === i
            return (
              <div key={i} className={`playlist-item ${isOpen ? 'open' : ''}`}>
                <button
                  type="button"
                  className="playlist-row"
                  onClick={() => {
                    if (!vid && it.url) window.open(it.url, '_blank', 'noopener,noreferrer')
                    else setOpen(isOpen ? null : i)
                  }}
                  aria-expanded={isOpen}
                >
                  <span className="playlist-cover">
                    {it.image ? <img src={it.image} alt="" /> : vid ? <img src={`https://i.ytimg.com/vi/${vid}/mqdefault.jpg`} alt="" /> : <i className="fa-solid fa-compact-disc" />}
                  </span>
                  <span className="playlist-info">
                    <strong>{it.title || '제목 없음'}</strong>
                    <span>{it.artist || '재생 / 가사 보기'}</span>
                  </span>
                  <i className={`fa-solid ${isOpen ? 'fa-circle-pause' : 'fa-circle-play'} playlist-play`} />
                </button>
                {isOpen && (
                  <div className="playlist-player">
                    {vid && (
                      <div className="video-wrap">
                        <iframe
                          src={`https://www.youtube.com/embed/${vid}?autoplay=1`}
                          title={it.title || 'YouTube'}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    )}
                    {it.lyrics && <div className="lyrics">{it.lyrics}</div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function CalendarWidget({ config, size, onMonthChange }) {
  const { site, admin } = useApp()
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const [days, setDays] = useState([])
  const [openDay, setOpenDay] = useState(null)
  const monthKey = `${cursor.y}-${pad(cursor.m + 1)}`
  useEffect(() => {
    onMonthChange?.(monthKey)
    let alive = true
    api
      .calendar(monthKey)
      .then((res) => alive && setDays(res.days))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [monthKey])

  // 일정: 캘린더에서 넣은 일정(사이트 공용) + 이 위젯 설정에 적은 일정 + 페어 시작일
  const events = useMemo(() => {
    const list = [...(site.events || [])]
    for (const e of config.events || []) list.push({ ...e, fixed: '홈 위젯 설정에서 고칠 수 있어요' })
    if (site.pair.startDate && config.showAnniversary !== false) {
      list.push({ date: site.pair.startDate, label: site.pair.startLabel || '기념일', annual: true, color: '', fixed: '사이트 설정의 페어 시작일' })
    }
    return list
  }, [site.events, config.events, config.showAnniversary, site.pair.startDate, site.pair.startLabel])

  const first = new Date(cursor.y, cursor.m, 1)
  const total = new Date(cursor.y, cursor.m + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < first.getDay(); i++) cells.push(null)
  for (let d = 1; d <= total; d++) cells.push(d)
  const today = todayStr()
  const dateOf = (d) => `${monthKey}-${pad(d)}`
  const eventsOn = (d) => events.filter((e) => eventOccurs(e, dateOf(d)))
  // 이번 달 일정 목록: 여러 날짜에 걸친 일정은 이번 달에서 처음 보이는 날에 한 번만
  const monthEvents = []
  const seen = new Set()
  for (const d of cells.filter(Boolean)) {
    for (const e of eventsOn(d)) {
      if (seen.has(e)) continue
      seen.add(e)
      monthEvents.push({ e, day: d })
    }
  }
  const move = (delta) =>
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })

  return (
    <div className="calendar-widget">
      <WidgetTitle config={config} fallback="" icon="fa-regular fa-calendar">
        <div className="cal-nav">
          <button type="button" className="icon-btn small" onClick={() => move(-1)} aria-label="이전 달">
            <i className="fa-solid fa-chevron-left" />
          </button>
          <span className="cal-month">
            {cursor.y}. {pad(cursor.m + 1)}
          </span>
          <button type="button" className="icon-btn small" onClick={() => move(1)} aria-label="다음 달">
            <i className="fa-solid fa-chevron-right" />
          </button>
        </div>
      </WidgetTitle>
      <div className="cal-grid">
        {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
          <span key={w} className="cal-week">
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />
          const date = dateOf(d)
          const posts = days.filter((p) => p.date === date)
          const evs = eventsOn(d)
          const cls = ['cal-day', date === today && 'today', posts.length && 'has-post', evs.length && 'has-event', i % 7 === 0 && 'sun', i % 7 === 6 && 'sat']
            .filter(Boolean)
            .join(' ')
          const label = `${d}일${posts.length ? `, 기록 ${posts.length}개` : ''}${evs.length ? `, 일정 ${evs.map((e) => e.label).join(', ')}` : ''}`
          const marks = (posts.length > 0 || evs.length > 0) && (
            <span className="cal-marks">
              {posts.length > 0 && <i />}
              {evs.slice(0, posts.length ? 2 : 3).map((e, k) => (
                <i key={k} className="ev" style={e.color ? { background: e.color } : undefined} />
              ))}
            </span>
          )
          // 글이나 일정이 있는 날(관리자는 모든 날)을 누르면 그날의 글·일정이 떠요.
          return posts.length || evs.length || admin ? (
            <button
              type="button"
              key={date}
              className={cls}
              aria-label={label}
              title={[...evs.map((e) => e.label), ...posts.map((p) => p.title)].join('\n') || undefined}
              onClick={() => setOpenDay(date)}
            >
              {d}
              {marks}
            </button>
          ) : (
            <span key={date} className={cls} aria-label={label}>
              {d}
            </span>
          )
        })}
      </div>
      {size !== 'S' && config.showList !== false && monthEvents.length > 0 && (
        <ul className="cal-events">
          {monthEvents.map(({ e, day }, i) => (
            <li key={i}>
              <button type="button" onClick={() => setOpenDay(dateOf(day))}>
                <span className="cal-event-day" style={e.color ? { color: e.color } : undefined}>
                  {cursor.m + 1}.{day}
                </span>
                <span className="cal-event-label">
                  {e.label}
                  {(e.time || (e.endDate && e.endDate > e.date)) && <small>{eventWhen(e).replace(/^매년 |^\d{4}\./g, '')}</small>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {openDay && (
        <DaySheet
          date={openDay}
          posts={days.filter((p) => p.date === openDay)}
          events={events.filter((e) => eventOccurs(e, openDay))}
          onClose={() => setOpenDay(null)}
        />
      )}
    </div>
  )
}

function GalleryWidget({ config }) {
  const count = Number(config.count) || 6
  const fromPosts = config.source !== 'manual'
  const posts = usePosts(fromPosts ? { limit: 30, category: config.category } : { limit: 1 }, [fromPosts, config.category])
  const items = fromPosts
    ? (posts || []).filter((p) => p.thumbnail).slice(0, count).map((p) => ({ image: p.thumbnail, href: `/post/${p.id}`, title: p.title }))
    : (config.items || []).filter((it) => it.image)
  return (
    <>
      <WidgetTitle config={config} fallback="갤러리" icon="fa-regular fa-images" />
      {!items.length ? (
        <Placeholder icon="fa-regular fa-images">{fromPosts && posts === null ? '불러오는 중' : '보여줄 이미지가 없어요'}</Placeholder>
      ) : (
        <div className="gallery-grid" style={{ '--cols': config.columns || 3, '--ratio': config.ratio || '1 / 1' }}>
          {items.map((it, i) => {
            const inner = (
              <>
                <img src={it.image} alt={it.title || ''} loading="lazy" />
                {it.title && config.showTitles !== false && <span className="gallery-caption">{it.title}</span>}
              </>
            )
            return it.href ? (
              <a key={i} href={it.href} className="gallery-cell">
                {inner}
              </a>
            ) : (
              <div key={i} className="gallery-cell">
                {inner}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function SlidesWidget({ config }) {
  const fromPosts = config.source === 'posts'
  const posts = usePosts(fromPosts ? { limit: 20, category: config.category } : { limit: 1 }, [fromPosts, config.category])
  const items = fromPosts
    ? (posts || []).filter((p) => p.thumbnail).map((p) => ({ image: p.thumbnail, href: `/post/${p.id}` }))
    : (config.items || []).filter((it) => it.image)
  const ref = useRef(null)
  const drag = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el || items.length === 0 || config.autoplay === false) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    let raf
    const speed = Number(config.speed) || 0.6
    let acc = 0
    const step = () => {
      if (!drag.current && !document.hidden) {
        const half = el.scrollWidth / 2
        acc += speed
        if (acc >= 1) {
          el.scrollLeft += Math.floor(acc)
          acc -= Math.floor(acc)
        }
        if (el.scrollLeft >= half) el.scrollLeft -= half
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [items.length, config.autoplay, config.speed])

  if (!items.length) return <Placeholder icon="fa-solid fa-film">{fromPosts && posts === null ? '불러오는 중' : '슬라이드 이미지를 추가해주세요'}</Placeholder>
  const doubled = config.autoplay === false ? items : [...items, ...items]
  return (
    <>
      <WidgetTitle config={config} fallback="" icon="fa-solid fa-film" />
      <div
        className="slides-widget"
        ref={ref}
        style={{ '--slide-h': `${config.height || 200}px` }}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false }
        }}
        onPointerMove={(e) => {
          if (!drag.current) return
          const dx = e.clientX - drag.current.x
          if (Math.abs(dx) > 4) drag.current.moved = true
          ref.current.scrollLeft = drag.current.left - dx
        }}
        onPointerUp={() => setTimeout(() => (drag.current = null), 0)}
        onPointerLeave={() => (drag.current = null)}
        onClickCapture={(e) => {
          if (drag.current?.moved) e.preventDefault()
        }}
      >
        {doubled.map((it, i) =>
          it.href ? (
            <a key={i} href={it.href} className="slide" draggable={false}>
              <img src={it.image} alt="" draggable={false} />
            </a>
          ) : (
            <div key={i} className="slide">
              <img src={it.image} alt="" draggable={false} />
            </div>
          ),
        )}
      </div>
    </>
  )
}

function TodoWidget({ config, onConfigChange }) {
  const { admin } = useApp()
  const items = config.items || []
  return (
    <>
      <WidgetTitle config={config} fallback="To-Do" icon="fa-solid fa-list-check" />
      <ul className="todo-list">
        {items.map((it, i) => (
          <li key={i}>
            <label className={it.done ? 'done' : ''}>
              <input
                type="checkbox"
                checked={!!it.done}
                disabled={!admin}
                onChange={(e) => onConfigChange?.({ ...config, items: items.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)) })}
              />
              <span>{it.text}</span>
            </label>
          </li>
        ))}
        {!items.length && <li className="muted">할 일을 추가해주세요</li>}
      </ul>
    </>
  )
}

function TagCloudWidget({ config }) {
  const [tags, setTags] = useState(null)
  useEffect(() => {
    api
      .tags()
      .then((res) => setTags(res.tags))
      .catch(() => setTags([]))
  }, [])
  const list = (tags || []).slice(0, Number(config.count) || 30)
  const max = Math.max(1, ...list.map((t) => t.count))
  return (
    <>
      <WidgetTitle config={config} fallback="태그" icon="fa-solid fa-hashtag" />
      {list.length ? (
        <ul className={`tag-cloud ${config.sized ? 'sized' : ''}`}>
          {list.map((t) => (
            <li key={t.name}>
              <a href={`/tag/${encodeURIComponent(t.name)}`} style={config.sized ? { fontSize: `${0.8 + (t.count / max) * 0.6}em` } : undefined}>
                #{t.name}
                {config.showCount && <small>{t.count}</small>}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <Placeholder icon="fa-solid fa-hashtag">{tags === null ? '불러오는 중' : '아직 태그가 없어요'}</Placeholder>
      )}
    </>
  )
}

function QuoteWidget({ config }) {
  const items = (config.items || []).filter((it) => it.text)
  const [i, setI] = useState(() => Math.floor(Math.random() * Math.max(1, items.length)))
  const it = items[i % Math.max(1, items.length)]
  return (
    <div className="quote-widget">
      <WidgetTitle config={config} fallback="" icon="fa-solid fa-quote-left" />
      {it ? (
        <button type="button" className="quote-body" onClick={() => setI((v) => v + 1)} title="다른 문장 보기">
          <i className="fa-solid fa-quote-left quote-mark" />
          <span className="quote-text">{it.text}</span>
          {it.author && <span className="quote-author">— {it.author}</span>}
        </button>
      ) : (
        <Placeholder icon="fa-solid fa-quote-left">문장을 추가해주세요</Placeholder>
      )}
    </div>
  )
}

function TextWidget({ config }) {
  return (
    <>
      <WidgetTitle config={config} fallback="" icon="" />
      <Content html={config.body || '<p>내용을 적어주세요.</p>'} className="prose widget-prose" runScripts={false} />
    </>
  )
}

function HtmlWidget({ config }) {
  return <Content html={config.html || '<p style="opacity:.6">HTML을 입력해주세요.</p>'} className="html-widget" />
}

function LinksWidget({ config }) {
  const { site } = useApp()
  const items = (config.useSiteLinks !== false && !config.items?.length ? site.links : config.items || []).filter((l) => l.url)
  return (
    <>
      <WidgetTitle config={config} fallback="링크" icon="fa-solid fa-link" />
      {items.length ? (
        <div className={`links-widget ${config.layout === 'icons' ? 'icons' : ''}`}>
          {items.map((l, i) => (
            <a key={i} href={l.url} target={/^https?:/.test(l.url) ? '_blank' : undefined} rel="noopener noreferrer" title={l.name}>
              <i className={l.icon || 'fa-solid fa-link'} />
              <span>{l.name}</span>
            </a>
          ))}
        </div>
      ) : (
        <Placeholder icon="fa-solid fa-link">링크를 추가해주세요</Placeholder>
      )}
    </>
  )
}

function ImageWidget({ config }) {
  if (!config.image) return <Placeholder icon="fa-regular fa-image">이미지를 골라주세요</Placeholder>
  const img = (
    <figure className="image-widget" style={{ '--ratio': config.ratio || 'auto' }}>
      <img src={config.image} alt={config.caption || ''} />
      {config.caption && <figcaption>{config.caption}</figcaption>}
    </figure>
  )
  return config.href ? <a href={config.href}>{img}</a> : img
}

function StatsWidget({ config }) {
  const { site, stats, categories } = useApp()
  const days = daysSince(site.pair.startDate)
  const cells = [
    site.pair.startDate && { value: days >= 0 ? days + 1 : `D${days}`, label: site.pair.startLabel || '함께한 날' },
    { value: stats.posts || 0, label: '기록' },
    { value: categories.length, label: '카테고리' },
  ].filter(Boolean)
  return (
    <>
      <WidgetTitle config={config} fallback="" icon="fa-solid fa-chart-simple" />
      <div className="stats-widget">
        {cells.map((c, i) => (
          <div key={i}>
            <b>{c.value}</b>
            <span>{c.label}</span>
          </div>
        ))}
      </div>
    </>
  )
}

function BannerBoardWidget({ config }) {
  const { site } = useApp()
  const banners = (site.banners || []).filter((b) => b.image || b.name).slice(0, Number(config.count) || 12)
  return (
    <>
      <WidgetTitle config={config} fallback="배너" icon="fa-solid fa-flag">
        <a className="widget-more" href="/banners">
          전체 <i className="fa-solid fa-chevron-right" />
        </a>
      </WidgetTitle>
      {banners.length ? <BannerGrid banners={banners} size="small" opts={{ ...config, caption: false }} /> : <Placeholder icon="fa-solid fa-flag">관리 › 배너 게시판에서 배너를 등록해주세요</Placeholder>}
    </>
  )
}

function SpacerWidget({ config }) {
  return <div className="spacer-widget" style={{ height: `${Number(config.height) || 40}px` }} aria-hidden="true" />
}

function BgmWidget() {
  return <BgmCard compact />
}

/* ------------------------------------------------------------------ */
/* 위젯 목록 (편집 화면의 설정 항목도 여기서 정의해요)                       */
/* ------------------------------------------------------------------ */

const listStyleOptions = [{ value: '', label: '사이트 기본값' }, ...LIST_STYLES]

export { CalendarWidget }

export const WIDGETS = {
  profile: {
    label: '프로필',
    icon: 'fa-solid fa-user-group',
    sizes: ['M', 'L'],
    Component: ProfileWidget,
    fields: [
      { key: 'mode', label: '표시', type: 'segmented', options: [{ value: 'pair', label: '페어' }, { value: 'me', label: '나' }, { value: 'partner', label: '상대' }] },
      {
        key: 'order',
        label: '순서 (페어일 때)',
        type: 'segmented',
        show: (c) => (c.mode || 'pair') === 'pair',
        options: [
          { value: 'partner-first', label: '최애 × 나' },
          { value: 'me-first', label: '나 × 최애' },
        ],
        help: '사진·이름·아이디 순서가 함께 바뀌어요. 관리 › 사이트의 "페어 이름"을 직접 적었다면 그 글자는 그대로예요.',
      },
      { key: 'layout', label: '배치', type: 'segmented', options: [{ value: 'row', label: '가로' }, { value: 'center', label: '가운데' }, { value: 'cover', label: '커버' }] },
      { key: 'cover', label: '커버 이미지', type: 'image', guide: 'profileCover', show: (c) => c.layout === 'cover' },
      { key: 'showBio', label: '소개글 보이기', type: 'toggle' },
      { key: 'showStats', label: '함께한 날 · 기록 수 보이기', type: 'toggle' },
    ],
    help: '이름·사진·소개글은 관리 > 사이트에서 바꿀 수 있어요.',
    defaults: { mode: 'pair', order: 'partner-first', layout: 'row', showBio: true, showStats: true },
  },
  shortcut: {
    label: '앱 아이콘 (바로가기)',
    icon: 'fa-solid fa-table-cells-large',
    sizes: ['S', 'M'],
    Component: ShortcutWidget,
    bare: true,
    fields: [
      { key: 'label', label: '이름' },
      { key: 'href', label: '연결할 주소', placeholder: '/archive 또는 https://...' },
      { key: 'icon', label: '아이콘', type: 'icon' },
      { key: 'image', label: '아이콘 대신 이미지', type: 'image', guide: 'appIcon' },
      { key: 'iconBg', label: '아이콘 배경색', type: 'color' },
      { key: 'desc', label: '설명 (M 크기에서만)' },
    ],
    defaults: { label: '바로가기', href: '/archive', icon: 'fa-solid fa-star' },
  },
  dday: {
    label: '디데이',
    icon: 'fa-solid fa-heart',
    sizes: ['M', 'L'],
    Component: DdayWidget,
    fields: [
      {
        key: 'items',
        label: '디데이 목록',
        type: 'list',
        itemLabel: '디데이',
        newItem: { title: '새 디데이', date: '', icon: 'fa-solid fa-star', mode: 'dday' },
        itemFields: [
          { key: 'title', label: '이름' },
          { key: 'date', label: '날짜 (비우면 페어 시작일)', type: 'date' },
          { key: 'mode', label: '세는 방식', type: 'segmented', options: [{ value: 'dplus', label: '1일부터' }, { value: 'dday', label: 'D±' }, { value: 'annual', label: '매년' }] },
          { key: 'icon', label: '아이콘', type: 'icon' },
          { key: 'image', label: '배경 이미지', type: 'image', guide: 'ddayBg' },
        ],
      },
    ],
    defaults: {},
  },
  clock: {
    label: '시계',
    icon: 'fa-regular fa-clock',
    sizes: ['M', 'L'],
    Component: ClockWidget,
    fields: [
      { key: 'style', label: '모양', type: 'segmented', options: [{ value: 'digital', label: '디지털' }, { value: 'analog', label: '아날로그' }] },
      { key: 'hour12', label: '12시간제', type: 'toggle' },
      { key: 'seconds', label: '초 보이기', type: 'toggle' },
      { key: 'label', label: '아래 문구' },
    ],
    defaults: { style: 'digital' },
  },
  recent: {
    label: '최근 글',
    icon: 'fa-solid fa-clock-rotate-left',
    sizes: ['M', 'L'],
    Component: RecentWidget,
    fields: [
      { key: 'count', label: '개수', type: 'number', min: 1, max: 20 },
      { key: 'category', label: '카테고리', type: 'category' },
      { key: 'sort', label: '정렬', type: 'segmented', options: [{ value: 'recent', label: '최신순' }, { value: 'views', label: '인기순' }] },
      { key: 'style', label: '목록 모양', type: 'select', options: listStyleOptions },
    ],
    defaults: { title: '최근 기록', count: 4, sort: 'recent', style: 'list' },
  },
  picks: {
    label: '추천 글 (인기글)',
    icon: 'fa-solid fa-fire',
    sizes: ['M', 'L'],
    Component: PicksWidget,
    fields: [{ key: 'items', label: '글 목록', type: 'list', itemLabel: '글', itemFields: [{ key: 'post', label: '글', type: 'post' }] }],
    defaults: { title: '인기글', items: [] },
  },
  notice: {
    label: '공지사항',
    icon: 'fa-solid fa-bullhorn',
    sizes: ['M', 'L'],
    Component: NoticeWidget,
    fields: [
      { key: 'source', label: '내용', type: 'segmented', options: [{ value: 'latest', label: '최근 공지 글' }, { value: 'manual', label: '직접 입력' }] },
      { key: 'count', label: '개수', type: 'number', min: 1, max: 10, show: (c) => c.source !== 'manual' },
      {
        key: 'items',
        label: '공지',
        type: 'list',
        itemLabel: '공지',
        show: (c) => c.source === 'manual',
        itemFields: [
          { key: 'title', label: '제목' },
          { key: 'body', label: '내용', type: 'textarea', rows: 2 },
          { key: 'href', label: '링크' },
        ],
      },
    ],
    defaults: { source: 'latest', count: 2 },
  },
  banner: {
    label: '배너',
    icon: 'fa-regular fa-images',
    sizes: ['M', 'L'],
    Component: BannerWidget,
    bare: true,
    fields: [
      { key: 'ratio', label: '비율', type: 'segmented', options: [{ value: '3 / 1', label: '3:1' }, { value: '2 / 1', label: '2:1' }, { value: '16 / 9', label: '16:9' }, { value: '1 / 1', label: '1:1' }] },
      { key: 'autoplay', label: '자동으로 넘기기', type: 'toggle' },
      { key: 'interval', label: '넘기는 간격(초)', type: 'number', min: 2, max: 30 },
      {
        key: 'items',
        label: '배너',
        type: 'list',
        itemLabel: '배너',
        itemFields: [
          { key: 'image', label: '이미지', type: 'image', guide: 'banner' },
          { key: 'href', label: '링크' },
          { key: 'caption', label: '문구' },
        ],
      },
    ],
    defaults: { ratio: '3 / 1', autoplay: true, interval: 5, items: [] },
  },
  playlist: {
    label: '플레이리스트',
    icon: 'fa-solid fa-music',
    sizes: ['M', 'L'],
    Component: PlaylistWidget,
    fields: [
      {
        key: 'items',
        label: '곡',
        type: 'list',
        itemLabel: '곡',
        itemFields: [
          { key: 'title', label: '제목' },
          { key: 'artist', label: '아티스트 / 설명' },
          { key: 'url', label: '유튜브 주소' },
          { key: 'image', label: '앨범 이미지 (비우면 유튜브 썸네일)', type: 'image', guide: 'album' },
          { key: 'lyrics', label: '가사', type: 'textarea', rows: 5 },
        ],
      },
    ],
    defaults: { title: '플레이리스트', items: [] },
  },
  calendar: {
    label: '캘린더',
    icon: 'fa-regular fa-calendar',
    sizes: ['M', 'L'],
    Component: CalendarWidget,
    fields: [
      { key: 'showAnniversary', label: '페어 시작일을 매년 표시', type: 'toggle' },
      { key: 'showList', label: '이번 달 일정 목록 보이기', type: 'toggle' },
      {
        key: 'events',
        label: '이 위젯에만 적는 일정 (캘린더에서 날짜를 눌러 넣은 일정은 모든 캘린더에 같이 보여요)',
        type: 'list',
        itemLabel: '일정',
        itemFields: [
          { key: 'date', label: '날짜', type: 'date' },
          { key: 'label', label: '내용' },
          { key: 'annual', label: '매년 반복', type: 'toggle' },
          { key: 'color', label: '표시 색', type: 'color' },
        ],
      },
    ],
    help: '글이 있는 날에는 점이 찍혀요. 날짜를 누르면 그날의 글과 일정이 뜨고, 관리자는 거기서 일정을 넣을 수 있어요.',
    defaults: { showAnniversary: true, showList: true, events: [] },
  },
  gallery: {
    label: '갤러리 (그리드)',
    icon: 'fa-solid fa-table-cells',
    sizes: ['M', 'L'],
    Component: GalleryWidget,
    fields: [
      { key: 'source', label: '이미지', type: 'segmented', options: [{ value: 'posts', label: '글 썸네일' }, { value: 'manual', label: '직접 고르기' }] },
      { key: 'category', label: '카테고리', type: 'category', show: (c) => c.source !== 'manual' },
      { key: 'count', label: '개수', type: 'number', min: 1, max: 30, show: (c) => c.source !== 'manual' },
      { key: 'columns', label: '열 수', type: 'range', min: 2, max: 6 },
      { key: 'ratio', label: '칸 비율', type: 'segmented', options: [{ value: '1 / 1', label: '1:1' }, { value: '3 / 4', label: '3:4' }, { value: '4 / 3', label: '4:3' }, { value: '16 / 9', label: '16:9' }] },
      { key: 'showTitles', label: '제목 보이기', type: 'toggle' },
      {
        key: 'items',
        label: '이미지',
        type: 'list',
        itemLabel: '이미지',
        show: (c) => c.source === 'manual',
        itemFields: [
          { key: 'image', label: '이미지', type: 'image', guide: 'gallery' },
          { key: 'title', label: '제목' },
          { key: 'href', label: '링크' },
        ],
      },
    ],
    defaults: { title: '갤러리', source: 'posts', count: 6, columns: 3, ratio: '1 / 1', showTitles: true },
  },
  slides: {
    label: '흐르는 갤러리',
    icon: 'fa-solid fa-film',
    sizes: ['M', 'L'],
    Component: SlidesWidget,
    fields: [
      { key: 'source', label: '이미지', type: 'segmented', options: [{ value: 'manual', label: '직접 고르기' }, { value: 'posts', label: '글 썸네일' }] },
      { key: 'category', label: '카테고리', type: 'category', show: (c) => c.source === 'posts' },
      { key: 'height', label: '높이', type: 'range', min: 100, max: 400, unit: 'px' },
      { key: 'autoplay', label: '자동으로 흐르기', type: 'toggle' },
      { key: 'speed', label: '속도', type: 'range', min: 0.2, max: 3, step: 0.1, show: (c) => c.autoplay !== false },
      {
        key: 'items',
        label: '이미지',
        type: 'list',
        itemLabel: '이미지',
        show: (c) => c.source !== 'posts',
        itemFields: [
          { key: 'image', label: '이미지', type: 'image', guide: 'slide' },
          { key: 'href', label: '링크' },
        ],
      },
    ],
    defaults: { source: 'manual', height: 200, autoplay: true, speed: 0.6, items: [] },
  },
  todo: {
    label: '투두리스트',
    icon: 'fa-solid fa-list-check',
    sizes: ['M', 'L'],
    Component: TodoWidget,
    fields: [
      {
        key: 'items',
        label: '할 일',
        type: 'list',
        itemLabel: '할 일',
        itemFields: [
          { key: 'text', label: '내용' },
          { key: 'done', label: '완료', type: 'toggle' },
        ],
      },
    ],
    help: '로그인한 상태에서는 홈 화면에서 바로 체크할 수 있어요.',
    defaults: { title: 'To-Do', items: [] },
  },
  tagcloud: {
    label: '태그 클라우드',
    icon: 'fa-solid fa-hashtag',
    sizes: ['M', 'L'],
    Component: TagCloudWidget,
    fields: [
      { key: 'count', label: '최대 개수', type: 'number', min: 1, max: 200 },
      { key: 'sized', label: '많이 쓴 태그를 크게', type: 'toggle' },
      { key: 'showCount', label: '글 수 보이기', type: 'toggle' },
    ],
    defaults: { title: '태그', count: 30 },
  },
  quote: {
    label: '한마디 (랜덤 문장)',
    icon: 'fa-solid fa-quote-left',
    sizes: ['M', 'L'],
    Component: QuoteWidget,
    fields: [
      {
        key: 'items',
        label: '문장',
        type: 'list',
        itemLabel: '문장',
        itemFields: [
          { key: 'text', label: '문장', type: 'textarea', rows: 2 },
          { key: 'author', label: '출처 / 말한 사람' },
        ],
      },
    ],
    help: '방문할 때마다 무작위로 하나가 보이고, 누르면 다음 문장으로 바뀌어요.',
    defaults: { items: [] },
  },
  text: {
    label: '메모 · 글상자',
    icon: 'fa-regular fa-note-sticky',
    sizes: ['M', 'L'],
    Component: TextWidget,
    fields: [{ key: 'body', label: '내용 (HTML 가능)', type: 'html', rows: 6 }],
    defaults: { title: '메모', body: '<p>자유롭게 적어보세요.</p>', style: 'memo' },
  },
  html: {
    label: 'HTML 직접 입력',
    icon: 'fa-solid fa-code',
    sizes: ['S', 'M', 'L'],
    Component: HtmlWidget,
    fields: [{ key: 'html', label: 'HTML / CSS / 스크립트', type: 'html', rows: 12 }],
    defaults: { html: '' },
  },
  links: {
    label: '링크 모음',
    icon: 'fa-solid fa-link',
    sizes: ['M', 'L'],
    Component: LinksWidget,
    fields: [
      { key: 'layout', label: '모양', type: 'segmented', options: [{ value: 'list', label: '목록' }, { value: 'icons', label: '아이콘' }] },
      {
        key: 'items',
        label: '링크 (비우면 사이트 링크 사용)',
        type: 'list',
        itemLabel: '링크',
        itemFields: [
          { key: 'name', label: '이름' },
          { key: 'url', label: '주소' },
          { key: 'icon', label: '아이콘', type: 'icon' },
        ],
      },
    ],
    defaults: { title: '링크', layout: 'list' },
  },
  image: {
    label: '사진 한 장',
    icon: 'fa-regular fa-image',
    sizes: ['S', 'M', 'L'],
    Component: ImageWidget,
    bare: true,
    fields: [
      { key: 'image', label: '이미지', type: 'image', guide: 'photo' },
      { key: 'ratio', label: '비율', type: 'segmented', options: [{ value: 'auto', label: '원본' }, { value: '1 / 1', label: '1:1' }, { value: '4 / 5', label: '4:5' }, { value: '16 / 9', label: '16:9' }] },
      { key: 'caption', label: '문구' },
      { key: 'href', label: '링크' },
    ],
    defaults: { ratio: '1 / 1' },
  },
  stats: {
    label: '숫자 요약',
    icon: 'fa-solid fa-chart-simple',
    sizes: ['M', 'L'],
    Component: StatsWidget,
    fields: [],
    defaults: {},
  },
  bannerboard: {
    label: '배너 게시판',
    icon: 'fa-solid fa-flag',
    sizes: ['M', 'L'],
    Component: BannerBoardWidget,
    fields: [
      { key: 'count', label: '최대 개수', type: 'number', min: 1, max: 60 },
      { key: 'columns', label: '한 줄에 몇 개', type: 'select', options: [{ value: '', label: '자동' }, ...[1, 2, 3, 4, 5, 6, 8].map((n) => ({ value: n, label: `${n}개` }))] },
      {
        key: 'fit',
        label: '배너 크기',
        type: 'segmented',
        options: [
          { value: 'original', label: '원본' },
          { value: 'fill', label: '칸에 꽉' },
          { value: 'fixed', label: '직접' },
        ],
      },
      { key: 'width', label: '배너 가로', type: 'range', min: 40, max: 400, unit: 'px', show: (c) => c.fit === 'fixed' },
      { key: 'height', label: '배너 세로 (0이면 비율대로)', type: 'range', min: 0, max: 200, unit: 'px', show: (c) => c.fit === 'fixed' },
      { key: 'gap', label: '간격', type: 'range', min: 0, max: 30, unit: 'px' },
    ],
    help: '배너는 관리 › 배너 게시판에서 등록해요.',
    defaults: { title: '배너', count: 12, columns: '', fit: 'original', width: 120, height: 0, gap: 8 },
  },
  spacer: {
    label: '빈칸 (여백)',
    icon: 'fa-solid fa-arrows-up-down',
    sizes: ['S', 'M', 'L'],
    Component: SpacerWidget,
    bare: true,
    fields: [{ key: 'height', label: '높이', type: 'range', min: 4, max: 400, unit: 'px' }],
    help: '위젯 사이를 띄우거나, 크기가 작게(S)·중간(M)이면 옆 칸을 비워둘 때 써요.',
    defaults: { height: 40, hideTitle: true },
  },
  bgm: {
    label: 'BGM 플레이어',
    icon: 'fa-solid fa-headphones',
    sizes: ['M', 'L'],
    Component: BgmWidget,
    bare: true,
    fields: [],
    help: '곡 목록은 관리 > 사이트 > BGM에서 정해요.',
    defaults: {},
  },
}

// 모든 위젯에 공통으로 붙는 꾸미기 항목
export const COMMON_WIDGET_FIELDS = [
  { type: 'heading', label: '공통 꾸미기' },
  { key: 'title', label: '위젯 제목' },
  { key: 'titleIcon', label: '제목 아이콘', type: 'icon' },
  { key: 'hideTitle', label: '제목 숨기기', type: 'toggle' },
  {
    key: 'style',
    label: '배경 스타일',
    type: 'select',
    options: [
      { value: '', label: '기본 카드' },
      { value: 'accent', label: '포인트 컬러' },
      { value: 'tinted', label: '연한 포인트' },
      { value: 'memo', label: '메모지' },
      { value: 'glass', label: '반투명 유리' },
      { value: 'outline', label: '테두리만' },
      { value: 'transparent', label: '투명 (배경 없음)' },
    ],
  },
  { key: 'bg', label: '배경색 직접 지정', type: 'color' },
  { key: 'color', label: '글자색 직접 지정', type: 'color' },
  { key: 'bgImage', label: '배경 이미지', type: 'image', guide: 'widgetBg' },
  { key: 'align', label: '정렬', type: 'segmented', options: [{ value: '', label: '기본' }, { value: 'center', label: '가운데' }] },
]
