import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { swapNames, useApp } from '../lib/store.jsx'
import { api } from '../lib/api.js'
import { navigate } from '../lib/router.js'
import { Content } from '../components/Content.jsx'
import { LargeTitle } from '../components/Shell.jsx'
import { Fields } from '../components/Fields.jsx'
import { RichEditor } from '../editor/RichEditor.jsx'
import { Sheet, Spinner } from '../components/ui.jsx'

// 페어 소개 페이지
// 첫 화면: 두 사람의 전신 이미지 + 간단 소개·키워드  →  이미지를 누르면 각자의 상세 화면(?c=0 / ?c=1)
// 상세 화면: 프로필 · 스테이터스 · 성격 키워드 · 소개글 · 위키 문서(팝업)
// 내용은 카테고리의 config(JSON)에 저장돼요.

function emptyChar(name = '', color = '') {
  return {
    zoom: 1.6,
    focusY: 6,
    name,
    subName: '',
    tagline: '',
    color,
    image: '',
    bg: '',
    keywords: [],
    intro: '',
    about: '',
    profile: [],
    status: [],
    wikiTitle: '',
    wiki: '',
  }
}

function defaultConfig(site) {
  return {
    eyebrow: 'PAIR ARCHIVE',
    title: site.pair?.pairName || '',
    subtitle: '',
    statusView: 'bar',
    statusCompare: false,
    chars: [emptyChar(site.pair?.partner?.name || '', '#6b7b8f'), emptyChar(site.pair?.me?.name || '', '#a07a68')],
  }
}

function normalize(config, site) {
  const base = defaultConfig(site)
  const c = { ...base, ...(config || {}) }
  const chars = Array.isArray(c.chars) ? c.chars : []
  c.chars = [0, 1].map((i) => ({ ...base.chars[i], ...(chars[i] || {}) }))
  return c
}

function charStyle(ch) {
  const style = {}
  if (ch.color) style['--pc'] = ch.color
  if (ch.bg) style['--pc-bg'] = ch.bg
  return style
}

export default function PairPage({ category, search }) {
  const app = useApp()
  const [raw, setRaw] = useState(null)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)
  const sp = new URLSearchParams(search)
  const sel = sp.get('c')
  const idx = sel === '0' || sel === '1' ? Number(sel) : null

  useEffect(() => {
    let alive = true
    setRaw(null)
    api
      .categoryConfig(category.id)
      .then((res) => alive && setRaw(res.config || {}))
      .catch((e) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [category.id])

  const config = useMemo(() => (raw ? normalize(raw, app.site) : null), [raw, app.site])

  const base = `/category/${encodeURIComponent(category.slug)}`

  useEffect(() => {
    if (!config) return
    const ch = idx !== null ? config.chars[idx] : null
    document.title = `${ch ? ch.name || ch.subName : config.title || category.name} :: ${app.site.title}`
  }, [config, idx, category.name, app.site.title])

  if (error) return <p className="form-error">{error}</p>
  if (!config) return <Spinner />

  const empty = !config.chars.some((c) => c.image || c.name)

  return (
    <div className="pair-page">
      {idx === null ? (
        <PairOverview config={config} base={base} empty={empty} admin={app.admin} category={category} />
      ) : (
        <PairDetail key={idx} config={config} idx={idx} base={base} />
      )}
      {app.admin && (
        <button type="button" className="fab" onClick={() => setEditing(true)} aria-label="페어 페이지 편집">
          <i className="fa-solid fa-pen-to-square" />
          <span>페어 편집</span>
        </button>
      )}
      {editing && (
        <PairEditor
          initial={config}
          startTab={idx === null ? 'page' : String(idx)}
          onClose={() => setEditing(false)}
          onSave={async (next) => {
            await api.saveCategoryConfig(category.id, next)
            setRaw(next)
            app.showToast('페어 페이지를 저장했어요.')
            setEditing(false)
          }}
        />
      )}
    </div>
  )
}

/* ---------------- 첫 화면 ---------------- */

function PairOverview({ config, base, empty, admin, category }) {
  const { site } = useApp()
  const nameGroup = useFitGroup()
  const [worldOpen, setWorldOpen] = useState(false)
  const go = (i) => navigate(`${base}?c=${i}`)

  return (
    <section className="pair-overview">
      <LargeTitle title={config.title ? swapNames(config.title, site) : category.name} subtitle={config.subtitle ? swapNames(config.subtitle, site) : ''} eyebrow={category.icon ? <i className={category.icon} /> : null} />

      <div className="pair-cards">
        {config.chars.map((ch, i) => (
          <button type="button" key={i} className="pair-pick" style={charStyle(ch)} onClick={() => go(i)} aria-label={`${ch.name || ch.subName || `캐릭터 ${i + 1}`} 자세히 보기`}>
            <span className="pair-pick-img">
              <span className="pair-panel-frame" aria-hidden="true" />
              {ch.image ? (
                <img src={ch.image} alt="" style={{ '--zoom': Number(ch.zoom) || 1.6, '--focus-y': `${Number(ch.focusY ?? 6)}%` }} />
              ) : (
                <span className="pair-panel-empty">
                  <i className="fa-solid fa-user" />
                </span>
              )}
            </span>
            <span className="pair-pick-info">
              <FitName className="pair-pick-name" text={ch.name || `캐릭터 ${i + 1}`} group={nameGroup} />
              {ch.keywords?.length > 0 && (
                <span className="pair-keywords">
                  {ch.keywords.map((k, j) => (
                    <span key={j} className="pair-chip">
                      {k}
                    </span>
                  ))}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      {config.worldWiki && (
        <button type="button" className="pair-wiki-btn pair-world-btn" onClick={() => setWorldOpen(true)}>
          <span className="pair-wiki-icon">
            <i className="fa-solid fa-earth-asia" />
          </span>
          <span className="pair-wiki-text">
            <strong>{config.worldWikiTitle || '세계관 위키'}</strong>
            <small>눌러서 펼쳐보기</small>
          </span>
          <i className="fa-solid fa-chevron-right" />
        </button>
      )}

      {worldOpen && <WikiModal title={config.worldWikiTitle || '세계관 위키'} html={config.worldWiki} onClose={() => setWorldOpen(false)} />}
      {empty && admin && <p className="pair-empty-hint">오른쪽 아래 '페어 편집'에서 두 사람의 이름과 전신 이미지를 넣어주세요.</p>}
    </section>
  )
}

/* ---------------- 상세 화면 ---------------- */

function PairDetail({ config, idx, base }) {
  const { site } = useApp()
  const ch = config.chars[idx]
  const [wikiOpen, setWikiOpen] = useState(false)

  return (
    <section className="pair-detail" style={charStyle(ch)}>
      <div className="pair-detail-bar">
        <button type="button" className="pair-back" onClick={() => navigate(base)}>
          <i className="fa-solid fa-chevron-left" /> {config.title ? swapNames(config.title, site) : '페어'}
        </button>
        <div className="pair-switch" role="tablist" aria-label="캐릭터 바꾸기">
          {config.chars.map((c, i) => (
            <button type="button" role="tab" key={i} aria-selected={i === idx} className={i === idx ? 'active' : ''} style={charStyle(c)} onClick={() => navigate(`${base}?c=${i}`, { replace: true })}>
              <span className="pair-switch-dot" />
              {c.name || c.subName || `캐릭터 ${i + 1}`}
            </button>
          ))}
        </div>
      </div>

      <div className="pair-detail-grid">
        <PairFigure ch={ch} />

        <div className="pair-info">
          <header className="pair-info-head">
            {ch.tagline && <span className="pair-tagline">{swapNames(ch.tagline, site)}</span>}
            <FitName as="h1" className="pair-name" text={ch.name || `캐릭터 ${idx + 1}`} />
            {ch.subName && <span className="pair-subname">{ch.subName}</span>}
          </header>

          {ch.keywords?.length > 0 && (
            <div className="pair-keywords">
              {ch.keywords.map((k, j) => (
                <span key={j} className="pair-chip">
                  {k}
                </span>
              ))}
            </div>
          )}

          {ch.intro && <p className="pair-intro">{swapNames(ch.intro, site)}</p>}


        </div>
      </div>

      {/* 프로필·스테이터스·소개·위키는 이미지 아래에 넓게 */}
      <div className="pair-sections">
          {ch.profile?.some((p) => p.label || p.value) && (
            <div className="pair-card">
              <h2 className="pair-card-title">프로필</h2>
              <dl className="pair-profile">
                {ch.profile
                  .filter((p) => p.label || p.value)
                  .map((p, j) => (
                    <div key={j} className="pair-profile-row">
                      <dt>{p.label}</dt>
                      <dd>{swapNames(p.value || '', site)}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          )}

          {ch.status?.some((s) => s.label) && (
            <div className="pair-card">
              <h2 className="pair-card-title">스테이터스</h2>
              <StatusView config={config} idx={idx}>
              <ul className="pair-status">
                {ch.status
                  .filter((s) => s.label)
                  .map((s, j) => {
                    const max = Number(s.max) || 100
                    const val = Math.max(0, Math.min(max, Number(s.value) || 0))
                    return (
                      <li key={j}>
                        <div className="pair-status-head">
                          <span>{s.label}</span>
                          <strong>{s.grade || `${val}${max === 100 ? '' : ` / ${max}`}`}</strong>
                        </div>
                        <div className="pair-status-bar" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={val} aria-label={s.label}>
                          <span style={{ width: `${(val / max) * 100}%` }} />
                        </div>
                      </li>
                    )
                  })}
              </ul>
              </StatusView>
            </div>
          )}

          {ch.about && (
            <div className="pair-card">
              <h2 className="pair-card-title">소개</h2>
              <Content html={ch.about} />
            </div>
          )}

          {ch.wiki && (
            <button type="button" className="pair-wiki-btn" onClick={() => setWikiOpen(true)}>
              <span className="pair-wiki-icon">
                <i className="fa-solid fa-book-open" />
              </span>
              <span className="pair-wiki-text">
                <strong>{ch.wikiTitle || '위키 문서'}</strong>
                <small>눌러서 펼쳐보기</small>
              </span>
              <i className="fa-solid fa-chevron-right" />
            </button>
          )}
      </div>

      {wikiOpen && <WikiModal title={ch.wikiTitle || `${ch.name || ch.subName} 위키`} html={ch.wiki} onClose={() => setWikiOpen(false)} />}
    </section>
  )
}

// 상세 화면 이미지: 전신 이미지 + 추가 이미지를 옆으로 넘겨 보고, 돋보기로 크게 보기
function PairFigure({ ch }) {
  const images = [ch.image, ...(Array.isArray(ch.images) ? ch.images.map((x) => x?.image) : [])].filter(Boolean)
  const [index, setIndex] = useState(0)
  const [zoom, setZoom] = useState(false)
  const trackRef = useRef(null)
  const alt = ch.name || ch.subName || ''

  const goTo = (i) => {
    const el = trackRef.current
    if (!el) return
    const n = Math.max(0, Math.min(images.length - 1, i))
    el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' })
  }
  const onScroll = () => {
    const el = trackRef.current
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }

  if (!images.length) {
    return (
      <div className="pair-figure">
        <span className="pair-panel-frame" aria-hidden="true" />
        <span className="pair-panel-empty">
          <i className="fa-solid fa-user" />
        </span>
      </div>
    )
  }

  return (
    <div className="pair-figure">
      <span className="pair-panel-frame" aria-hidden="true" />
      <div className="pair-slides" ref={trackRef} onScroll={onScroll} tabIndex={images.length > 1 ? 0 : -1} aria-roledescription="이미지 넘기기"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') goTo(index + 1)
          if (e.key === 'ArrowLeft') goTo(index - 1)
        }}
      >
        {images.map((src, i) => (
          <div className="pair-slide" key={i} aria-hidden={i !== index}>
            <img src={src} alt={`${alt} ${i + 1}`} loading={i ? 'lazy' : undefined} draggable={false} />
          </div>
        ))}
      </div>
      <button type="button" className="pair-zoom-btn" onClick={() => setZoom(true)} aria-label="이미지 크게 보기" title="크게 보기">
        <i className="fa-solid fa-magnifying-glass-plus" />
      </button>
      {images.length > 1 && (
        <>
          <button type="button" className="pair-slide-arrow prev" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="이전 이미지">
            <i className="fa-solid fa-chevron-left" />
          </button>
          <button type="button" className="pair-slide-arrow next" onClick={() => goTo(index + 1)} disabled={index === images.length - 1} aria-label="다음 이미지">
            <i className="fa-solid fa-chevron-right" />
          </button>
          <div className="pair-slide-dots" role="tablist">
            {images.map((_, i) => (
              <button type="button" key={i} role="tab" aria-selected={i === index} className={i === index ? 'active' : ''} onClick={() => goTo(i)} aria-label={`${i + 1}번째 이미지`} />
            ))}
          </div>
        </>
      )}
      {zoom && <ImageZoom images={images} start={index} alt={alt} onClose={() => setZoom(false)} />}
    </div>
  )
}

function ImageZoom({ images, start, alt, onClose }) {
  const [i, setI] = useState(start)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setI((v) => Math.min(images.length - 1, v + 1))
      if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1))
    }
    window.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('no-scroll')
    }
  }, [images.length, onClose])
  return createPortal(
    <div className="pair-zoom" role="dialog" aria-modal="true" aria-label="이미지 크게 보기" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <img src={images[i]} alt={`${alt} ${i + 1}`} />
      <button type="button" className="pair-zoom-close" onClick={onClose} aria-label="닫기" autoFocus>
        <i className="fa-solid fa-xmark" />
      </button>
      {images.length > 1 && (
        <>
          <button type="button" className="pair-zoom-arrow prev" onClick={() => setI((v) => Math.max(0, v - 1))} disabled={i === 0} aria-label="이전 이미지">
            <i className="fa-solid fa-chevron-left" />
          </button>
          <button type="button" className="pair-zoom-arrow next" onClick={() => setI((v) => Math.min(images.length - 1, v + 1))} disabled={i === images.length - 1} aria-label="다음 이미지">
            <i className="fa-solid fa-chevron-right" />
          </button>
          <span className="pair-zoom-count">
            {i + 1} / {images.length}
          </span>
        </>
      )}
    </div>,
    document.body,
  )
}

function WikiModal({ title, html, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('no-scroll')
    }
  }, [onClose])
  return createPortal(
    <div className="wiki-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="wiki-window" role="dialog" aria-modal="true" aria-label={title}>
        <div className="wiki-head">
          <span className="wiki-head-icon">
            <i className="fa-solid fa-book-open" />
          </span>
          <strong>{title}</strong>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="위키 닫기" autoFocus>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="wiki-body">
          <Content html={html} className="prose wiki-prose" />
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ---------------- 스테이터스 육각형(다각형) 표 ---------------- */

// 스탯 값 0~1 비율 (최대값을 넘거나 숫자가 아니면 잘라요)
function statRatio(s) {
  const max = Number(s?.max) || 100
  return Math.max(0, Math.min(1, (Number(s?.value) || 0) / max))
}

// 막대 / 막대 + 육각형 / 육각형만. 스탯이 3개보다 적으면 도형을 그릴 수 없어 막대만 보여요.
function StatusView({ config, idx, children }) {
  const view = config.statusView || 'bar'
  const stats = (config.chars[idx].status || []).filter((s) => s.label)
  if (view === 'bar' || stats.length < 3) return children
  const other = config.statusCompare ? config.chars[1 - idx] : null
  return (
    <div className={`pair-status-wrap view-${view}`}>
      <StatusRadar stats={stats} self={config.chars[idx]} other={other} />
      {view === 'both' && children}
    </div>
  )
}

const RADAR_R = 92
const RADAR_LEVELS = 4

function StatusRadar({ stats, self, other }) {
  const n = stats.length
  const point = (i, r) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n
    return [Math.cos(a) * r, Math.sin(a) * r]
  }
  const poly = (ratios) => ratios.map((v, i) => point(i, RADAR_R * v).map((x) => x.toFixed(1)).join(',')).join(' ')
  const mine = stats.map(statRatio)
  // 겹쳐 볼 캐릭터: 같은 이름의 스탯끼리 짝지어요.
  const otherStats = other ? stats.map((s) => (other.status || []).find((o) => o.label === s.label)) : null
  return (
    <figure className="pair-radar">
      <svg viewBox="-170 -142 340 284" role="img" aria-label={stats.map((s) => `${s.label} ${s.grade || s.value || 0}`).join(', ')}>
        {Array.from({ length: RADAR_LEVELS }, (_, k) => (
          <polygon key={k} className="radar-grid" points={poly(Array(n).fill((k + 1) / RADAR_LEVELS))} />
        ))}
        {stats.map((_, i) => {
          const [x, y] = point(i, RADAR_R)
          return <line key={i} className="radar-axis" x1="0" y1="0" x2={x.toFixed(1)} y2={y.toFixed(1)} />
        })}
        {otherStats && <polygon className="radar-area other" points={poly(otherStats.map(statRatio))} style={other.color ? { '--rc': other.color } : undefined} />}
        <polygon className="radar-area" points={poly(mine)} />
        {mine.map((v, i) => {
          const [x, y] = point(i, RADAR_R * v)
          return <circle key={i} className="radar-dot" cx={x.toFixed(1)} cy={y.toFixed(1)} r="3.2" />
        })}
        {stats.map((s, i) => {
          const [x, y] = point(i, RADAR_R + 20)
          const anchor = Math.abs(x) < 8 ? 'middle' : x > 0 ? 'start' : 'end'
          const max = Number(s.max) || 100
          const val = Math.max(0, Math.min(max, Number(s.value) || 0))
          return (
            <text key={i} className="radar-label" x={x.toFixed(1)} y={(y + (y > 8 ? 8 : y < -8 ? -6 : 2)).toFixed(1)} textAnchor={anchor}>
              <tspan>{s.label}</tspan>
              <tspan className="radar-value" x={x.toFixed(1)} dy="1.15em">
                {s.grade || `${val}${max === 100 ? '' : ` / ${max}`}`}
              </tspan>
            </text>
          )
        })}
      </svg>
      {otherStats && (
        <figcaption className="pair-radar-legend">
          <span className="me">{self.name || self.subName || '이 캐릭터'}</span>
          <span className="other" style={other.color ? { '--rc': other.color } : undefined}>
            {other.name || other.subName || '다른 캐릭터'}
          </span>
        </figcaption>
      )}
    </figure>
  )
}

/* ---------------- 편집 ---------------- */

const PAGE_FIELDS = [
  { key: 'title', label: '페어 이름 (첫 화면 제목)', placeholder: '등대와 철새' },
  { key: 'subtitle', label: '한 줄 소개', placeholder: '겨울마다 한 번씩, 같은 골목에서.' },
  { type: 'heading', label: '스테이터스 표시', help: '스탯이 3개 이상일 때 육각형(스탯 수만큼 꼭짓점이 있는 도형) 표로 보여줄 수 있어요. 6개면 정육각형이에요.' },
  {
    key: 'statusView',
    label: '모양',
    type: 'segmented',
    options: [
      { value: 'bar', label: '막대' },
      { value: 'both', label: '막대 + 육각형' },
      { value: 'radar', label: '육각형만' },
    ],
  },
  { key: 'statusCompare', label: '육각형에 다른 캐릭터 겹쳐 보기', type: 'toggle', help: '두 사람의 스탯을 한 도형에 겹쳐 비교해요.', show: (c) => c.statusView === 'both' || c.statusView === 'radar' },
]

const CHAR_BASIC = [
  { type: 'heading', label: '기본' },
  { key: 'name', label: '큰 이름 (영문 추천)', placeholder: 'DOHA' },
  { key: 'subName', label: '이름 아래 작은 글', placeholder: '이도하' },
  { key: 'tagline', label: '이름 위 한 줄', placeholder: '밤에만 문을 여는 고서점 주인.' },
  { key: 'image', label: '전신 이미지', type: 'image', guide: 'fullBody', uploadOptions: { maxSize: 2000, keepPng: true } },
  {
    key: 'images',
    label: '추가 이미지 (상세 화면에서 옆으로 넘겨 봐요)',
    type: 'list',
    itemLabel: '이미지',
    itemFields: [{ key: 'image', label: '이미지', type: 'image', guide: 'fullBody', uploadOptions: { maxSize: 2000, keepPng: true } }],
  },
  { key: 'zoom', label: '첫 화면 이미지 확대 (1이면 전신, 클수록 반신을 크게)', type: 'range', min: 1, max: 3, step: 0.05 },
  { key: 'focusY', label: '확대 기준 높이 (얼굴이 잘리면 줄이고, 너무 위가 비면 늘려요)', type: 'range', min: 0, max: 60, unit: '%' },
  { key: 'color', label: '대표 색 (키워드·테두리·스테이터스 막대)', type: 'color' },
  { key: 'bg', label: '이미지 뒤 배경색 (비우면 대표 색을 옅게)', type: 'color' },
  { key: 'intro', label: '간단 소개 (상세 화면)', type: 'textarea', rows: 2 },
]

const CHAR_FIELDS = [
  { type: 'heading', label: '프로필' },
  {
    key: 'profile',
    label: '프로필 항목',
    help: '항목 이름·순서·개수는 두 캐릭터가 함께 써요. 한쪽에서 추가·삭제·이름 변경하면 다른 쪽도 똑같이 바뀌고, 내용만 캐릭터마다 따로 적어요.',
    type: 'list',
    itemLabel: '항목',
    itemFields: [
      { key: 'label', label: '항목', placeholder: '나이 / 키 / 생일 / 직업' },
      { key: 'value', label: '내용 (Enter로 줄바꿈)', type: 'textarea', rows: 2 },
    ],
  },
  { type: 'heading', label: '스테이터스' },
  {
    key: 'status',
    label: '스테이터스 항목',
    help: '스탯 이름·순서·개수는 두 캐릭터가 함께 써요. 값·최대값·등급은 캐릭터마다 따로 정해요.',
    type: 'list',
    itemLabel: '스탯',
    itemFields: [
      { key: 'label', label: '이름', placeholder: '체력 / 지능 / 매력' },
      { key: 'value', label: '값', type: 'number', min: 0 },
      { key: 'max', label: '최대값 (비우면 100)', type: 'number', min: 1 },
      { key: 'grade', label: '등급 표시 (선택, 예: A+ · ★★★)', placeholder: '비우면 숫자' },
    ],
  },
  { type: 'heading', label: '위키 문서' },
  { key: 'wikiTitle', label: '위키 버튼 제목', placeholder: '위키 문서' },
]

// 프로필·스테이터스 항목은 두 캐릭터가 같은 이름·순서로 함께 써요. (내용만 캐릭터마다 달라요)
const SHARED_LISTS = ['profile', 'status']

// 예전에 따로 만든 목록도 맞춰줘요: 이름이 같은 항목끼리 짝짓고, 한쪽에만 있는 항목은 다른 쪽에 빈 내용으로 넣어요.
function alignLists(a = [], b = []) {
  const rows = a.map((it) => ({ label: it.label || '', a: it }))
  for (const it of b) {
    const row = it.label && rows.find((r) => !r.b && r.label === it.label)
    if (row) row.b = it
    else rows.push({ label: it.label || '', b: it })
  }
  return [rows.map((r) => r.a || { label: r.label }), rows.map((r) => r.b || { label: r.label })]
}

function alignChars(config) {
  const chars = config.chars.map((c) => ({ ...c }))
  for (const key of SHARED_LISTS) [chars[0][key], chars[1][key]] = alignLists(chars[0][key], chars[1][key])
  return { ...config, chars }
}

// 한쪽 목록이 next로 바뀌었을 때(추가·삭제·순서 바꾸기·이름 변경) 다른 쪽 목록을 같은 모양으로 맞춰요.
// 목록 칸은 바뀌지 않은 항목을 그대로 두므로, 원래 몇 번째 항목이었는지로 다른 쪽 내용을 따라가요.
function syncList(prev, next, other) {
  return next.map((item, k) => {
    const from = prev.indexOf(item)
    const base = from >= 0 ? other[from] : next.length === prev.length ? other[k] : null
    return { ...(base || {}), label: item.label ?? '' }
  })
}

function PairEditor({ initial, startTab, onClose, onSave }) {
  const [draft, setDraft] = useState(() => alignChars(JSON.parse(JSON.stringify(initial))))
  const [tab, setTab] = useState(startTab)
  const [busy, setBusy] = useState(false)
  const setChar = (i, patch) => setDraft((d) => ({ ...d, chars: d.chars.map((c, j) => (j === i ? { ...c, ...patch } : c)) }))
  // 프로필·스테이터스를 고치면 다른 캐릭터의 항목 이름·순서·개수도 똑같이 맞춰요.
  const setCharLists = (i, v) =>
    setDraft((d) => {
      const cur = d.chars[i]
      const chars = d.chars.map((c, j) => (j === i ? { ...c, ...v } : c))
      const o = 1 - i
      for (const key of SHARED_LISTS) {
        if (v[key] !== cur[key]) chars[o] = { ...chars[o], [key]: syncList(cur[key] || [], v[key] || [], d.chars[o][key] || []) }
      }
      return { ...d, chars }
    })
  const ci = tab === 'page' ? null : Number(tab)
  const ch = ci !== null ? draft.chars[ci] : null

  async function save() {
    setBusy(true)
    try {
      await onSave(draft)
    } catch (e) {
      window.alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      title="페어 페이지 편집"
      onClose={onClose}
      wide
      footer={
        <div className="row gap-s" style={{ width: '100%' }}>
          <button type="button" className="btn" onClick={onClose} style={{ flex: 1 }}>
            취소
          </button>
          <button type="button" className="btn primary" onClick={save} disabled={busy} style={{ flex: 2 }}>
            {busy ? '저장 중...' : '저장'}
          </button>
        </div>
      }
    >
      <div className="segmented pair-edit-tabs" role="tablist">
        {[
          ['page', '페이지'],
          ['0', draft.chars[0].name || draft.chars[0].subName || '왼쪽 캐릭터'],
          ['1', draft.chars[1].name || draft.chars[1].subName || '오른쪽 캐릭터'],
        ].map(([v, label]) => (
          <button type="button" key={v} role="tab" aria-selected={tab === v} className={tab === v ? 'active' : ''} onClick={() => setTab(v)}>
            {label}
          </button>
        ))}
      </div>

      {ci === null ? (
        <>
          <p className="sheet-help">첫 화면 맨 위 제목과 소개예요. 두 사람의 내용은 위 탭에서 각각 적어요. ({'{{나}}'} {'{{상대}}'} 이름 변환을 쓸 수 있어요)</p>
          <Fields fields={PAGE_FIELDS} value={draft} onChange={(v) => setDraft((d) => ({ ...d, ...v, chars: d.chars }))} />
          <div className="fields">
            <h3 className="fields-heading">세계관 위키</h3>
            <div className="field">
              <label className="field-label" htmlFor="world-wiki-title">
                버튼 제목
              </label>
              <input id="world-wiki-title" value={draft.worldWikiTitle || ''} onChange={(e) => setDraft((d) => ({ ...d, worldWikiTitle: e.target.value }))} placeholder="세계관 위키" />
            </div>
            <div className="field">
              <span className="field-label">세계관 위키 내용</span>
              <p className="field-help">첫 화면 페어 이름 아래 버튼을 누르면 팝업으로 펼쳐져요. 'HTML' 버튼으로 바꾸면 위키 코드를 그대로 붙여넣을 수 있어요. 비우면 버튼이 숨겨져요.</p>
              <RichEditor value={draft.worldWiki || ''} onChange={(v) => setDraft((d) => ({ ...d, worldWiki: v }))} mode={draft.worldWikiMode || 'rich'} onModeChange={(m) => setDraft((d) => ({ ...d, worldWikiMode: m }))} />
            </div>
          </div>
        </>
      ) : (
        <div key={ci}>
          <Fields fields={CHAR_BASIC} value={ch} onChange={(v) => setChar(ci, v)} />
          <div className="fields">
            <div className="field">
              <span className="field-label">성격 키워드</span>
              <KeywordsInput value={ch.keywords || []} onChange={(v) => setChar(ci, { keywords: v })} />
              <p className="field-help">입력하고 Enter나 쉼표(,)를 누르면 하나씩 들어가요.</p>
            </div>
          </div>
          <Fields fields={CHAR_FIELDS} value={ch} onChange={(v) => setCharLists(ci, v)} />
          <div className="fields">
            <div className="field">
              <span className="field-label">위키 문서 내용</span>
              <p className="field-help">위키 버튼을 누르면 팝업으로 펼쳐져요. 'HTML' 버튼으로 바꾸면 위키 코드(HTML·&lt;style&gt;)를 그대로 붙여넣을 수 있어요. 비우면 위키 버튼이 숨겨져요.</p>
              <RichEditor value={ch.wiki || ''} onChange={(v) => setChar(ci, { wiki: v })} mode={ch.wikiMode || 'rich'} onModeChange={(m) => setChar(ci, { wikiMode: m })} />
            </div>
            <div className="field">
              <span className="field-label">소개글</span>
              <p className="field-help">상세 화면 아래쪽 '소개' 카드에 보여요.</p>
              <RichEditor value={ch.about || ''} onChange={(v) => setChar(ci, { about: v })} mode={ch.aboutMode || 'rich'} onModeChange={(m) => setChar(ci, { aboutMode: m })} />
            </div>
          </div>
        </div>
      )}
    </Sheet>
  )
}

// 키워드: 입력하고 Enter나 쉼표(,)를 누르면 칩으로 들어가요. (띄어쓰기도 쓸 수 있어요)
function KeywordsInput({ value, onChange }) {
  const [text, setText] = useState('')
  const add = () => {
    const parts = text
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (parts.length) onChange([...value, ...parts.filter((p) => !value.includes(p))])
    setText('')
  }
  return (
    <div className="kw-input">
      {value.map((k, i) => (
        <span key={i} className="kw-chip">
          {k}
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`${k} 지우기`}>
            <i className="fa-solid fa-xmark" />
          </button>
        </span>
      ))}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add()
          } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1))
        }}
        onBlur={add}
        placeholder={value.length ? '키워드 더하기' : '예: 차분함 (Enter로 추가)'}
        aria-label="키워드 입력"
      />
    </div>
  )
}

// 이름이 칸보다 길면 줄바꿈하지 않고 글자 크기를 줄여서 한 줄에 맞춰요.
// 같은 group에 묶인 이름들은 가장 많이 줄어야 하는 쪽에 맞춰 같은 비율로 함께 줄어요.
function fitBoxes(boxes) {
  boxes.forEach((b) => (b.style.fontSize = ''))
  const sizes = boxes.map((b) => parseFloat(getComputedStyle(b).fontSize) || 48)
  let ratio = 1
  for (const b of boxes) {
    const avail = b.clientWidth
    const need = b.firstChild?.getBoundingClientRect().width || 0
    if (avail > 0 && need > avail) ratio = Math.min(ratio, avail / need)
  }
  if (ratio < 1) boxes.forEach((b, i) => (b.style.fontSize = `${Math.max(14, Math.floor(sizes[i] * ratio * 0.98))}px`))
}

function useFitGroup() {
  const ref = useRef(null)
  if (!ref.current) {
    const els = new Set()
    const fitAll = () => fitBoxes([...els])
    ref.current = {
      fitAll,
      add(el) {
        els.add(el)
        fitAll()
        return () => {
          els.delete(el)
          fitAll()
        }
      },
    }
  }
  return ref.current
}

function FitName({ text, as: Tag = 'strong', className = '', group }) {
  const boxRef = useRef(null)
  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return
    const fit = group ? group.fitAll : () => fitBoxes([box])
    const off = group ? group.add(box) : (fit(), null)
    let w = box.clientWidth
    const ro = new ResizeObserver(() => {
      if (box.clientWidth !== w) {
        w = box.clientWidth
        fit()
      }
    })
    ro.observe(box)
    document.fonts?.ready?.then(fit)
    return () => {
      ro.disconnect()
      off?.()
    }
  }, [text, group])
  return (
    <Tag ref={boxRef} className={`${className} fit-name`}>
      <span>{text}</span>
    </Tag>
  )
}
