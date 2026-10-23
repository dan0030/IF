import React, { useEffect, useId, useState } from 'react'
import { uploadFile, pickFile } from '../lib/image.js'
import { api } from '../lib/api.js'
import { useApp } from '../lib/store.jsx'
import { Segmented, Switch } from './ui.jsx'
import { ImageEditor } from './ImageEditor.jsx'
import { IMAGE_GUIDES, guideText } from '../lib/imageGuides.js'

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

export function setPath(obj, path, value) {
  const keys = path.split('.')
  const out = Array.isArray(obj) ? [...obj] : { ...(obj || {}) }
  let cur = out
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]
    cur[k] = Array.isArray(cur[k]) ? [...cur[k]] : { ...(cur[k] || {}) }
    cur = cur[k]
  }
  cur[keys[keys.length - 1]] = value
  return out
}

// 설정 스키마(fields)를 받아 폼을 그려줍니다. 위젯 설정, 사이트 설정, 디자인 설정이 모두 이걸 써요.
export function Fields({ fields, value, onChange }) {
  return (
    <div className="fields">
      {fields.map((f, i) => {
        if (f.show && !f.show(value)) return null
        if (f.type === 'heading') {
          return (
            <h3 className="fields-heading" key={`h-${i}`}>
              {f.label}
              {f.help && <small>{f.help}</small>}
            </h3>
          )
        }
        return <Field key={f.key} field={f} value={getPath(value, f.key)} onChange={(v) => onChange(setPath(value, f.key, v))} />
      })}
    </div>
  )
}

export function Field({ field: f, value, onChange }) {
  // 목록 안의 칸(예: BGM 곡 '제목')과 바깥 칸의 id가 겹치지 않게 칸마다 고유한 id를 써요.
  const uid = useId()
  const id = `f-${f.key.replace(/\./g, '-')}-${uid.replace(/:/g, '')}`
  if (f.type === 'toggle') {
    return (
      <div className="field">
        <Switch checked={value} onChange={onChange} label={f.label} description={f.help} />
      </div>
    )
  }
  return (
    <div className={`field field-${f.type || 'text'}`}>
      {f.label && (
        <label className="field-label" htmlFor={id}>
          {f.label}
        </label>
      )}
      <FieldInput id={id} f={f} value={value} onChange={onChange} />
      {f.help && <p className="field-help">{f.help}</p>}
    </div>
  )
}

function FieldInput({ id, f, value, onChange }) {
  switch (f.type) {
    case 'textarea':
    case 'html':
      return (
        <textarea
          id={id}
          className={f.type === 'html' ? 'code' : ''}
          rows={f.rows || (f.type === 'html' ? 8 : 4)}
          value={value ?? ''}
          placeholder={f.placeholder}
          spellCheck={f.type !== 'html'}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'number':
      return (
        <input
          id={id}
          type="number"
          min={f.min}
          max={f.max}
          step={f.step || 1}
          placeholder={f.placeholder}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
      )
    case 'range':
      return (
        <div className="range-row">
          <input id={id} type="range" min={f.min} max={f.max} step={f.step || 1} value={value ?? f.min} onChange={(e) => onChange(Number(e.target.value))} />
          <output>
            {value}
            {f.unit || ''}
          </output>
        </div>
      )
    case 'color':
      return <ColorInput id={id} value={value} onChange={onChange} />
    case 'select':
      return (
        <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )
    case 'segmented':
      return <Segmented value={value} options={f.options} onChange={onChange} />
    case 'date':
      return <input id={id} type="date" value={value || ''} onChange={(e) => onChange(e.target.value)} />
    case 'image':
      return <ImageInput id={id} value={value} onChange={onChange} accept={f.accept} uploadOptions={f.uploadOptions} guide={f.guide} />
    case 'icon':
      return <IconInput id={id} value={value} onChange={onChange} />
    case 'strings':
      return (
        <input
          id={id}
          value={(value || []).join(' ')}
          placeholder={f.placeholder}
          onChange={(e) => onChange(e.target.value.split(/\s+/).filter(Boolean))}
        />
      )
    case 'post':
      return <PostSelect id={id} value={value} onChange={onChange} />
    case 'category':
      return <CategorySelect id={id} value={value} onChange={onChange} />
    case 'list':
      return <ListInput f={f} value={value} onChange={onChange} />
    case 'navItems':
      return <NavItemsInput value={value} onChange={onChange} />
    default:
      return <input id={id} type="text" value={value ?? ''} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />
  }
}

export function ColorInput({ id, value, onChange }) {
  const hex = /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#000000'
  return (
    <div className="color-input">
      <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} aria-label="색 고르기" />
      <input id={id} type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="#ffffff 또는 rgba(...)" />
    </div>
  )
}

// 편집기로 열 수 있는 사진인지 (SVG·커서·아이콘 파일은 그대로 올려요)
export function isEditableImage(nameOrType) {
  return !/svg|icon|\.cur$|\.ico$|\.svg$/i.test(nameOrType || '')
}

export function ImageInput({ id, value, onChange, accept = 'image/*', uploadOptions, guide }) {
  const app = useApp()
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(null) // { src, file, name }
  const g = IMAGE_GUIDES[guide]

  async function upload() {
    const [file] = await pickFile(accept)
    if (!file) return
    if (!file.type.startsWith('image/') || !isEditableImage(file.type + file.name)) {
      await send(file, false)
      return
    }
    setEditing({ src: URL.createObjectURL(file), file, name: file.name })
  }

  async function send(file, edited) {
    setBusy(true)
    try {
      // 편집기에서 크기를 정했으면 그대로, 아니면 너무 큰 사진만 줄여서 올려요.
      onChange(edited ? (await api.upload(file)).url : await uploadFile(file, uploadOptions))
      setEditing(null)
    } catch (e) {
      app.showToast(e.message)
    } finally {
      setBusy(false)
    }
  }

  function close() {
    if (editing?.src?.startsWith('blob:')) URL.revokeObjectURL(editing.src)
    setEditing(null)
  }

  return (
    <div className="image-input-wrap">
      <div className="image-input">
        {value && /image|\.cur/.test(accept) ? (
          <img src={value} alt="" className={g?.shape === 'circle' ? 'circle' : ''} style={g?.ratio ? { aspectRatio: String(g.ratio), width: g.ratio > 1.5 ? 140 : 76 } : undefined} />
        ) : (
          <div className="image-input-empty">
            <i className="fa-regular fa-image" />
          </div>
        )}
        <div className="image-input-side">
          <input id={id} type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="이미지 주소 또는 업로드" />
          <div className="row gap-s wrap">
            <button type="button" className="btn small" onClick={upload} disabled={busy}>
              <i className="fa-solid fa-arrow-up-from-bracket" /> {busy ? '올리는 중' : '업로드'}
            </button>
            {value && isEditableImage(value) && /image/.test(accept) && (
              <button type="button" className="btn small" onClick={() => setEditing({ src: value, name: value.split('/').pop() })} disabled={busy}>
                <i className="fa-solid fa-crop-simple" /> 편집
              </button>
            )}
            {value && (
              <button type="button" className="btn small ghost" onClick={() => onChange('')}>
                지우기
              </button>
            )}
          </div>
        </div>
      </div>
      {g && (
        <p className="image-guide-hint">
          <i className="fa-solid fa-ruler-combined" /> {guideText(guide)}
          {g.shape === 'circle' ? ' · 동그랗게 보여요' : ''}
          <a href="/admin/images" target="_blank" rel="noopener">
            가이드
          </a>
        </p>
      )}
      {editing && (
        <ImageEditor src={editing.src} fileName={editing.name} guide={guide} originalFile={editing.file} onCancel={close} onApply={(file, { edited }) => send(file, edited)} />
      )}
    </div>
  )
}

export const COMMON_ICONS = [
  'fa-solid fa-heart', 'fa-regular fa-heart', 'fa-solid fa-star', 'fa-solid fa-moon', 'fa-solid fa-sun', 'fa-solid fa-cloud',
  'fa-solid fa-feather', 'fa-solid fa-pen-nib', 'fa-solid fa-book-open', 'fa-solid fa-bookmark', 'fa-solid fa-envelope', 'fa-solid fa-paper-plane',
  'fa-solid fa-music', 'fa-solid fa-headphones', 'fa-solid fa-camera', 'fa-regular fa-image', 'fa-solid fa-film', 'fa-solid fa-palette',
  'fa-solid fa-gift', 'fa-solid fa-cake-candles', 'fa-solid fa-mug-hot', 'fa-solid fa-ice-cream', 'fa-solid fa-utensils', 'fa-solid fa-seedling',
  'fa-solid fa-clover', 'fa-solid fa-leaf', 'fa-solid fa-snowflake', 'fa-solid fa-umbrella', 'fa-solid fa-gem', 'fa-solid fa-crown',
  'fa-solid fa-ring', 'fa-solid fa-key', 'fa-solid fa-lock', 'fa-solid fa-house', 'fa-solid fa-comment-dots', 'fa-solid fa-comments',
  'fa-solid fa-hashtag', 'fa-regular fa-calendar', 'fa-solid fa-clock', 'fa-solid fa-bell', 'fa-solid fa-bullhorn', 'fa-solid fa-link',
  'fa-solid fa-folder', 'fa-solid fa-layer-group', 'fa-solid fa-list-check', 'fa-solid fa-fire', 'fa-solid fa-wand-magic-sparkles', 'fa-solid fa-dove',
  'fa-solid fa-cat', 'fa-solid fa-dog', 'fa-solid fa-paw', 'fa-solid fa-ghost', 'fa-solid fa-gamepad', 'fa-solid fa-plane',
  'fa-brands fa-x-twitter', 'fa-brands fa-instagram', 'fa-brands fa-youtube', 'fa-brands fa-spotify', 'fa-brands fa-discord', 'fa-brands fa-pinterest',
]

export function IconInput({ id, value, onChange }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="icon-input">
      <div className="row gap-s">
        <span className="icon-preview">
          <i className={value || 'fa-solid fa-circle'} />
        </span>
        <input id={id} type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="fa-solid fa-heart" />
        <button type="button" className="btn small" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          고르기
        </button>
      </div>
      {open && (
        <div className="icon-grid">
          {COMMON_ICONS.map((ic) => (
            <button
              type="button"
              key={ic}
              className={ic === value ? 'active' : ''}
              onClick={() => {
                onChange(ic)
                setOpen(false)
              }}
              aria-label={ic}
            >
              <i className={ic} />
            </button>
          ))}
          <a className="icon-grid-more" href="https://fontawesome.com/search?o=r&m=free" target="_blank" rel="noopener noreferrer">
            더 많은 아이콘 찾기 (Font Awesome)
          </a>
        </div>
      )}
    </div>
  )
}

let postCache = null
function PostSelect({ id, value, onChange }) {
  const [posts, setPosts] = useState(postCache || [])
  useEffect(() => {
    if (postCache) return
    api.posts({ limit: 60, type: 'all' }).then((res) => {
      postCache = res.items
      setPosts(res.items)
    })
  }, [])
  return (
    <select id={id} value={value || ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}>
      <option value="">글 고르기</option>
      {posts.map((p) => (
        <option key={p.id} value={p.id}>
          {p.title || '(제목 없음)'}
        </option>
      ))}
    </select>
  )
}

function CategorySelect({ id, value, onChange }) {
  const { categories } = useApp()
  return (
    <select id={id} value={value || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">전체</option>
      {categories.map((c) => (
        <option key={c.id} value={c.slug}>
          {c.parent_id ? '└ ' : ''}
          {c.name}
        </option>
      ))}
    </select>
  )
}

function ListInput({ f, value, onChange }) {
  const items = Array.isArray(value) ? value : []
  const update = (i, v) => onChange(items.map((it, j) => (j === i ? v : it)))
  const move = (i, d) => {
    const j = i + d
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  return (
    <div className="list-input">
      {items.map((item, i) => (
        <div className="list-input-item" key={i}>
          <div className="list-input-head">
            <span>
              {f.itemLabel || '항목'} {i + 1}
            </span>
            <div className="row gap-xs">
              <button type="button" className="icon-btn small" onClick={() => move(i, -1)} disabled={i === 0} aria-label="위로">
                <i className="fa-solid fa-arrow-up" />
              </button>
              <button type="button" className="icon-btn small" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="아래로">
                <i className="fa-solid fa-arrow-down" />
              </button>
              <button type="button" className="icon-btn small danger" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="삭제">
                <i className="fa-solid fa-trash" />
              </button>
            </div>
          </div>
          <Fields fields={f.itemFields} value={item} onChange={(v) => update(i, v)} />
        </div>
      ))}
      <button type="button" className="btn small" onClick={() => onChange([...items, { ...(f.newItem || {}) }])}>
        <i className="fa-solid fa-plus" /> {f.itemLabel || '항목'} 추가
      </button>
    </div>
  )
}

/* ---------------- 하단 탭 메뉴 고르기 ---------------- */

const NAV_PRESETS = [
  { label: '홈', icon: 'fa-solid fa-house', href: '/' },
  { label: '기록', icon: 'fa-solid fa-book-open', href: '/archive' },
  { label: '캘린더', icon: 'fa-regular fa-calendar', href: '/calendar' },
  { label: '방명록', icon: 'fa-regular fa-comment-dots', href: '/guestbook' },
  { label: '태그', icon: 'fa-solid fa-hashtag', href: '/tags' },
  { label: '공지', icon: 'fa-solid fa-bullhorn', href: '/notice' },
  { label: '배너', icon: 'fa-solid fa-flag', href: '/banners' },
  { label: '검색', icon: 'fa-solid fa-magnifying-glass', href: '/search' },
  { label: '글쓰기', icon: 'fa-solid fa-pen', href: '/write', adminOnly: true },
  { label: '관리', icon: 'fa-solid fa-gear', href: '/admin', adminOnly: true },
]

export function NavItemsInput({ value, onChange }) {
  const { site, categories } = useApp()
  const items = Array.isArray(value) ? value : site.bottomNav || []
  const [custom, setCustom] = useState(false)
  const full = items.length >= 6
  const set = (next) => onChange(next)
  const update = (i, patch) => set(items.map((it, j) => (j === i ? { ...it, ...patch } : it)))
  const move = (i, d) => {
    const j = i + d
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    set(next)
  }
  const presets = [
    ...NAV_PRESETS,
    ...categories.map((c) => ({ label: c.name, icon: c.icon || 'fa-solid fa-folder', href: `/category/${c.slug}` })),
  ].filter((p) => !items.some((it) => it.href === p.href))

  return (
    <div className="nav-items">
      <div className="nav-preview" aria-hidden="true">
        {items.slice(0, 6).map((it, i) => (
          <span key={i} className={i === 0 ? 'active' : ''}>
            <i className={it.icon || 'fa-solid fa-circle'} />
            <small>{it.label}</small>
          </span>
        ))}
        {!items.length && <small className="muted">탭이 없어요</small>}
      </div>
      <div className="nav-rows">
        {items.map((it, i) => (
          <div className="nav-row" key={i}>
            <span className="nav-row-icon">
              <i className={it.icon || 'fa-solid fa-circle'} />
            </span>
            <input value={it.label || ''} onChange={(e) => update(i, { label: e.target.value })} aria-label="탭 이름" />
            <input className="nav-row-href" value={it.href || ''} onChange={(e) => update(i, { href: e.target.value })} aria-label="주소" />
            <label className="check nav-row-admin" title="로그인했을 때만 보이기">
              <input type="checkbox" checked={!!it.adminOnly} onChange={(e) => update(i, { adminOnly: e.target.checked })} />
              <span>
                <i className="fa-solid fa-lock" />
              </span>
            </label>
            <div className="row gap-xs">
              <button type="button" className="icon-btn small" onClick={() => move(i, -1)} disabled={i === 0} aria-label="앞으로">
                <i className="fa-solid fa-arrow-up" />
              </button>
              <button type="button" className="icon-btn small" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="뒤로">
                <i className="fa-solid fa-arrow-down" />
              </button>
              <button type="button" className="icon-btn small danger" onClick={() => set(items.filter((_, j) => j !== i))} aria-label="빼기">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="field-help">
        {full ? '탭은 6개까지 넣을 수 있어요. 하나를 빼야 더 넣을 수 있어요.' : `눌러서 추가해요 (${items.length}/6). 자물쇠를 켜면 로그인했을 때만 보여요.`}
      </p>
      {!full && (
        <div className="nav-presets">
          {presets.map((p) => (
            <button type="button" key={p.href} className="chip" onClick={() => set([...items, p])}>
              <i className={p.icon} /> {p.label}
            </button>
          ))}
          <button type="button" className="chip" onClick={() => setCustom((v) => !v)}>
            <i className="fa-solid fa-plus" /> 직접 만들기
          </button>
        </div>
      )}
      {custom && !full && (
        <CustomNavForm
          onAdd={(it) => {
            set([...items, it])
            setCustom(false)
          }}
        />
      )}
    </div>
  )
}

function CustomNavForm({ onAdd }) {
  const [it, setIt] = useState({ label: '', href: '', icon: 'fa-solid fa-star' })
  return (
    <div className="list-input-item">
      <Fields
        fields={[
          { key: 'label', label: '이름' },
          { key: 'href', label: '주소', placeholder: '/category/... 또는 https://...' },
          { key: 'icon', label: '아이콘', type: 'icon' },
        ]}
        value={it}
        onChange={setIt}
      />
      <button type="button" className="btn small primary" disabled={!it.label || !it.href} onClick={() => onAdd(it)} style={{ marginTop: 12 }}>
        추가
      </button>
    </div>
  )
}
