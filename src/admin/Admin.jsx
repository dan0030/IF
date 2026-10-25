import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { api } from '../lib/api.js'
import { navigate, scrollRoot } from '../lib/router.js'
import { formatDate, formatDateTime } from '../lib/format.js'
import { DEFAULT_THEME, LIST_STYLES, PAGE_TYPES, PRESETS, deepMerge, resolveTheme } from '../lib/defaults.js'
import { LargeTitle } from '../components/Shell.jsx'
import { Fields, IconInput, ColorInput } from '../components/Fields.jsx'
import { Empty, Paging, Segmented, Spinner } from '../components/ui.jsx'
import ImageGuidesTab from './ImageGuides.jsx'
import { orderCategories } from '../lib/categories.js'
import { BANNER_FIELDS, PAGE_FIELDS, DESIGN_SECTIONS, PALETTE_KEYS, SITE_FIELDS } from './schemas.js'

const TABS = [
  { key: 'site', label: '사이트', icon: 'fa-solid fa-house-chimney-user' },
  { key: 'design', label: '디자인', icon: 'fa-solid fa-palette' },
  { key: 'home', label: '홈 화면', icon: 'fa-solid fa-table-cells-large' },
  { key: 'categories', label: '카테고리', icon: 'fa-solid fa-folder-tree' },
  { key: 'banners', label: '배너 게시판', icon: 'fa-solid fa-flag' },
  { key: 'pages', label: '페이지 문구', icon: 'fa-solid fa-heading' },
  { key: 'images', label: '이미지 가이드 · 사진 편집', icon: 'fa-solid fa-crop-simple' },
  { key: 'posts', label: '글 관리', icon: 'fa-regular fa-file-lines' },
  { key: 'comments', label: '댓글 · 방명록', icon: 'fa-regular fa-comments' },
  { key: 'backup', label: '백업 · 파일', icon: 'fa-solid fa-box-archive' },
]

export default function Admin({ tab }) {
  const app = useApp()
  const current = TABS.find((t) => t.key === tab) || null

  useEffect(() => {
    document.title = `관리 :: ${app.site.title}`
  }, [app.site.title])

  if (!app.admin) {
    return (
      <Empty icon="fa-solid fa-lock" title="로그인이 필요해요">
        <a href="/login" className="btn primary">
          로그인
        </a>
      </Empty>
    )
  }

  if (!current) {
    return (
      <div className="admin">
        <LargeTitle title="관리" subtitle="사이트를 내 마음대로 꾸며보세요" />
        <div className="settings-list card">
          {TABS.map((t) => (
            <a key={t.key} href={`/admin/${t.key}`} className="settings-row">
              <span className="settings-icon">
                <i className={t.icon} />
              </span>
              <span className="settings-label">{t.label}</span>
              <i className="fa-solid fa-chevron-right settings-chevron" />
            </a>
          ))}
        </div>
        <div className="settings-list card">
          <a href="/write" className="settings-row">
            <span className="settings-icon accent">
              <i className="fa-solid fa-pen" />
            </span>
            <span className="settings-label">새 글 쓰기</span>
            <i className="fa-solid fa-chevron-right settings-chevron" />
          </a>
          <a href="/write?type=notice" className="settings-row">
            <span className="settings-icon">
              <i className="fa-solid fa-bullhorn" />
            </span>
            <span className="settings-label">새 공지 쓰기</span>
            <i className="fa-solid fa-chevron-right settings-chevron" />
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="admin">
      <LargeTitle title={current.label} eyebrow={<a href="/admin" className="back-link"><i className="fa-solid fa-chevron-left" /> 관리</a>} />
      {tab === 'site' && <SiteTab />}
      {tab === 'banners' && <SiteTab fields={BANNER_FIELDS} />}
      {tab === 'pages' && <SiteTab fields={PAGE_FIELDS} />}
      {tab === 'images' && <ImageGuidesTab />}
      {tab === 'design' && <DesignTab />}
      {tab === 'home' && <HomeTab />}
      {tab === 'categories' && <CategoriesTab />}
      {tab === 'posts' && <PostsTab />}
      {tab === 'comments' && <CommentsTab />}
      {tab === 'backup' && <BackupTab />}
    </div>
  )
}

function SaveBar({ dirty, busy, onSave, onReset, label = '저장' }) {
  return (
    <div className={`save-bar ${dirty ? 'show' : ''}`}>
      <span>{dirty ? '저장하지 않은 변경사항이 있어요' : '모두 저장됨'}</span>
      <div className="row gap-s">
        {onReset && (
          <button type="button" className="btn small ghost" onClick={onReset} disabled={!dirty || busy}>
            되돌리기
          </button>
        )}
        <button type="button" className="btn small primary" onClick={onSave} disabled={!dirty || busy}>
          {busy ? '저장 중...' : label}
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function SiteTab({ fields = SITE_FIELDS }) {
  const app = useApp()
  const [draft, setDraft] = useState(app.site)
  const [busy, setBusy] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(app.site)

  async function save() {
    setBusy(true)
    try {
      await app.saveSetting('site', draft)
      app.showToast('저장했어요.')
    } catch (e) {
      app.showToast(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="card padded">
        <Fields fields={fields} value={draft} onChange={setDraft} />
      </div>
      <SaveBar dirty={dirty} busy={busy} onSave={save} onReset={() => setDraft(app.site)} />
    </>
  )
}

/* ------------------------------------------------------------------ */

function DesignTab() {
  const app = useApp()
  const [draft, setDraft] = useState(app.savedTheme)
  const [section, setSection] = useState('preset')
  const [busy, setBusy] = useState(false)
  const [paletteMode, setPaletteMode] = useState(app.mode)
  const dirty = JSON.stringify(draft) !== JSON.stringify(app.savedTheme)

  // 방금 누른 옵션의 화면 위치. 배경·본문 창·글자 크기가 바뀌어 페이지가 밀려도 그 옵션이 제자리에 있게 해요.
  const anchor = useRef(null)
  function rememberAnchor(e) {
    const el = e.target.closest?.('button, input, select, label, textarea')
    if (el) anchor.current = { el, top: el.getBoundingClientRect().top }
  }

  // 고치는 동안 사이트 전체에 바로 미리 적용해요.
  useEffect(() => {
    app.setPreviewTheme(draft)
    const a = anchor.current
    if (!a) return
    // 테마가 화면에 적용된 뒤(다음 프레임)에 위치를 맞춰요.
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => {
        if (anchor.current !== a || !a.el.isConnected) return
        const diff = a.el.getBoundingClientRect().top - a.top
        if (Math.abs(diff) > 1) (scrollRoot() || window).scrollBy(0, diff)
        a.top = a.el.getBoundingClientRect().top
      })
    })
    return () => cancelAnimationFrame(id)
  }, [draft])
  useEffect(() => () => app.setPreviewTheme(null), [])

  useEffect(() => {
    if (paletteMode !== app.mode) app.toggleMode()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paletteMode])

  async function save() {
    setBusy(true)
    try {
      await app.saveSetting('theme', draft)
      app.showToast('디자인을 저장했어요.')
    } catch (e) {
      app.showToast(e.message)
    } finally {
      setBusy(false)
    }
  }

  function applyPreset(p) {
    setDraft((d) => deepMerge({ ...d, light: DEFAULT_THEME.light, dark: DEFAULT_THEME.dark }, { ...p.theme, preset: p.key }))
  }

  async function copyTheme() {
    const text = JSON.stringify(draft, null, 2)
    try {
      await navigator.clipboard.writeText(text)
      app.showToast('디자인 코드를 복사했어요.')
    } catch {
      window.prompt('아래 코드를 복사하세요', text)
    }
  }

  function pasteTheme() {
    const text = window.prompt('복사해둔 디자인 코드를 붙여넣어 주세요')
    if (!text) return
    try {
      setDraft(resolveTheme(JSON.parse(text)))
      app.showToast('불러왔어요. 마음에 들면 저장을 눌러주세요.')
    } catch {
      app.showToast('디자인 코드 형식이 올바르지 않아요.')
    }
  }

  const sections = [{ key: 'preset', label: '테마', icon: 'fa-solid fa-swatchbook' }, { key: 'colors', label: '색상', icon: 'fa-solid fa-droplet' }, ...DESIGN_SECTIONS]
  const active = DESIGN_SECTIONS.find((s) => s.key === section)

  return (
    <div className="design-editor" onPointerDownCapture={rememberAnchor} onKeyDownCapture={rememberAnchor}>
      <div className="design-tabs" role="tablist">
        {sections.map((s) => (
          <button type="button" key={s.key} role="tab" aria-selected={section === s.key} className={section === s.key ? 'active' : ''} onClick={() => setSection(s.key)}>
            <i className={s.icon} />
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {section === 'preset' && (
        <div className="card padded">
          <p className="sheet-help">테마를 고르면 색·글꼴·모양이 한 번에 바뀌어요. 그다음 다른 탭에서 세세하게 다듬을 수 있어요.</p>
          <div className="preset-grid">
            {PRESETS.map((p) => {
              const t = deepMerge(DEFAULT_THEME, p.theme)
              const pal = app.mode === 'dark' ? t.dark : t.light
              return (
                <button type="button" key={p.key} className={`preset ${draft.preset === p.key ? 'active' : ''}`} onClick={() => applyPreset(p)}>
                  <span className="preset-swatch" style={{ background: t.bgType === 'gradient' ? `linear-gradient(135deg, ${pal.bg}, ${pal.bg2})` : pal.bg, borderRadius: Math.min(t.radius, 18) }}>
                    <span className="preset-card" style={{ background: pal.surface, color: pal.text, borderRadius: Math.min(t.radius, 14) * 0.7 }}>
                      <span style={{ background: pal.accent }} />
                      <i style={{ background: pal.textSub }} />
                    </span>
                  </span>
                  <span className="preset-name">{p.label}</span>
                </button>
              )
            })}
          </div>
          <div className="row gap-s wrap">
            <button type="button" className="btn small" onClick={copyTheme}>
              <i className="fa-regular fa-copy" /> 디자인 코드 복사
            </button>
            <button type="button" className="btn small" onClick={pasteTheme}>
              <i className="fa-regular fa-paste" /> 디자인 코드 붙여넣기
            </button>
            <button type="button" className="btn small ghost" onClick={() => setDraft(DEFAULT_THEME)}>
              처음 상태로
            </button>
          </div>
        </div>
      )}

      {section === 'colors' && (
        <div className="card padded">
          <div className="field">
            <span className="field-label">고칠 모드</span>
            <Segmented
              value={paletteMode}
              onChange={setPaletteMode}
              options={[
                { value: 'light', label: '라이트', icon: 'fa-solid fa-sun' },
                { value: 'dark', label: '다크', icon: 'fa-solid fa-moon' },
              ]}
            />
          </div>
          <div className="palette-grid">
            {PALETTE_KEYS.map((p) => (
              <div className="field" key={p.key}>
                <span className="field-label">{p.label}</span>
                <ColorInput value={draft[paletteMode][p.key]} onChange={(v) => setDraft((d) => ({ ...d, [paletteMode]: { ...d[paletteMode], [p.key]: v } }))} />
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn small"
            onClick={() => {
              const other = paletteMode === 'light' ? 'dark' : 'light'
              setDraft((d) => ({ ...d, [other]: { ...d[other], accent: d[paletteMode].accent } }))
              app.showToast('포인트 색을 반대 모드에도 맞췄어요.')
            }}
          >
            포인트 색을 반대 모드에도 적용
          </button>
        </div>
      )}

      {active && (
        <div className="card padded">
          <Fields fields={active.fields} value={draft} onChange={setDraft} />
        </div>
      )}

      <SaveBar dirty={dirty} busy={busy} onSave={save} onReset={() => setDraft(app.savedTheme)} />
    </div>
  )
}

/* ------------------------------------------------------------------ */

function HomeTab() {
  const app = useApp()
  const [json, setJson] = useState(() => JSON.stringify(app.home, null, 2))
  const [busy, setBusy] = useState(false)

  async function saveJson() {
    let parsed
    try {
      parsed = JSON.parse(json)
      if (!Array.isArray(parsed.pages)) throw new Error()
    } catch {
      app.showToast('JSON 형식이 올바르지 않아요.')
      return
    }
    setBusy(true)
    try {
      await app.saveSetting('home', parsed)
      app.showToast('저장했어요.')
    } catch (e) {
      app.showToast(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="card padded">
        <p>
          홈 화면은 스마트폰 홈 화면처럼 <b>여러 페이지</b>에 <b>위젯</b>을 배치해서 만들어요. 홈에서 오른쪽 아래 <b>홈 편집</b> 버튼을 누르면 위젯을 추가하고, 끌어서 옮기고, 크기와
          꾸미기를 바꿀 수 있어요.
        </p>
        <button type="button" className="btn primary" onClick={() => navigate('/')}>
          <i className="fa-solid fa-pen-to-square" /> 홈으로 가서 편집하기
        </button>
      </div>
      <details className="card padded more-options">
        <summary>고급: 홈 화면 JSON 직접 고치기</summary>
        <textarea className="code" rows={18} value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} />
        <button type="button" className="btn small primary" onClick={saveJson} disabled={busy}>
          JSON 저장
        </button>
      </details>
    </>
  )
}

/* ------------------------------------------------------------------ */

function CategoriesTab() {
  const app = useApp()
  const toDraft = (cats) => cats.map((c) => ({ ...c, key: String(c.id), parentKey: c.parent_id ? String(c.parent_id) : '' }))
  const [list, setList] = useState(() => toDraft(app.categories))
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(null)

  const update = (i, patch) => setList((l) => l.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  const move = (i, d) =>
    setList((l) => {
      const j = i + d
      if (j < 0 || j >= l.length) return l
      const next = [...l]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  function add() {
    const key = `new-${Date.now()}`
    setList((l) => [...l, { key, name: '새 카테고리', slug: '', icon: 'fa-solid fa-folder', description: '', list_style: '', page_type: 'posts', parentKey: '', hidden: 0, count: 0 }])
    setOpen(key)
  }

  async function save() {
    setBusy(true)
    try {
      const payload = list.map((c) => ({ ...c, parentKey: c.parentKey || null, id: /^\d+$/.test(c.key) ? Number(c.key) : null }))
      const res = await api.saveCategories(payload)
      app.setCategories(res.categories)
      setList(toDraft(orderCategories(res.categories)))
      app.showToast('카테고리를 저장했어요.')
    } catch (e) {
      app.showToast(e.message)
    } finally {
      setBusy(false)
    }
  }

  // 하위 카테고리는 부모 바로 아래에 보이도록 정렬해서 보여줍니다.
  const roots = list.filter((c) => !c.parentKey || !list.some((p) => p.key === c.parentKey))

  const renderItem = (c, depth) => {
    const i = list.indexOf(c)
    const isOpen = open === c.key
    return (
      <div key={c.key} className={`cat-edit ${depth ? 'child' : ''}`}>
        <div className="cat-edit-row">
          <span className="cat-edit-icon">
            <i className={c.icon || 'fa-solid fa-folder'} />
          </span>
          <button type="button" className="cat-edit-name" onClick={() => setOpen(isOpen ? null : c.key)} aria-expanded={isOpen}>
            {c.name}
            {c.page_type === 'thread' ? <small className="badge">타래</small> : c.page_type === 'pair' ? <small className="badge">페어</small> : null}
            {c.hidden ? <small> (숨김)</small> : null}
            <small className="muted"> · 글 {c.count || 0}</small>
          </button>
          <div className="row gap-xs">
            <button type="button" className="icon-btn small" onClick={() => move(i, -1)} aria-label="위로">
              <i className="fa-solid fa-arrow-up" />
            </button>
            <button type="button" className="icon-btn small" onClick={() => move(i, 1)} aria-label="아래로">
              <i className="fa-solid fa-arrow-down" />
            </button>
            <button
              type="button"
              className="icon-btn small danger"
              onClick={() => window.confirm(`'${c.name}'을(를) 지울까요? 안에 있던 글은 '카테고리 없음'이 돼요.`) && setList((l) => l.filter((x) => x !== c).map((x) => (x.parentKey === c.key ? { ...x, parentKey: '' } : x)))}
              aria-label="삭제"
            >
              <i className="fa-solid fa-trash" />
            </button>
          </div>
        </div>
        {isOpen && (
          <div className="cat-edit-form fields">
            <div className="field">
              <span className="field-label">페이지 종류</span>
              <div className="page-type-pick">
                {PAGE_TYPES.map((t) => (
                  <button type="button" key={t.value} className={(c.page_type || 'posts') === t.value ? 'active' : ''} onClick={() => update(i, { page_type: t.value })} aria-pressed={(c.page_type || 'posts') === t.value}>
                    <i className={t.icon} />
                    <strong>{t.label}</strong>
                    <small>{t.desc}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label className="field-label">이름</label>
              <input value={c.name} onChange={(e) => update(i, { name: e.target.value })} />
            </div>
            <div className="field">
              <label className="field-label">주소 (비우면 이름으로 자동)</label>
              <input value={c.slug} onChange={(e) => update(i, { slug: e.target.value })} placeholder="예: daily" />
            </div>
            <div className="field">
              <label className="field-label">아이콘</label>
              <IconInput value={c.icon} onChange={(v) => update(i, { icon: v })} />
            </div>
            <div className="field">
              <label className="field-label">설명</label>
              <input value={c.description || ''} onChange={(e) => update(i, { description: e.target.value })} />
            </div>
            {(c.page_type || 'posts') === 'posts' && (
            <div className="field">
              <label className="field-label">목록 모양</label>
              <select value={c.list_style || ''} onChange={(e) => update(i, { list_style: e.target.value })}>
                <option value="">사이트 기본값</option>
                {LIST_STYLES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            )}
            <div className="field">
              <label className="field-label">상위 카테고리</label>
              <select value={c.parentKey || ''} onChange={(e) => update(i, { parentKey: e.target.value })}>
                <option value="">없음 (최상위)</option>
                {list
                  .filter((p) => p.key !== c.key && !p.parentKey)
                  .map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
            <label className="check">
              <input type="checkbox" checked={!!c.hidden} onChange={(e) => update(i, { hidden: e.target.checked ? 1 : 0 })} />
              <span>방문자에게 숨기기</span>
            </label>
            <label className="check">
              <input type="checkbox" checked={!!c.hide_count} onChange={(e) => update(i, { hide_count: e.target.checked ? 1 : 0 })} />
              <span>서랍 메뉴에서 이 카테고리의 글 개수 숨기기</span>
            </label>
          </div>
        )}
        {list.filter((k) => k.parentKey === c.key).map((k) => renderItem(k, depth + 1))}
      </div>
    )
  }

  const dirty = JSON.stringify(list) !== JSON.stringify(toDraft(app.categories))
  return (
    <>
      <div className="card padded">
        {list.length === 0 && <p className="muted">아직 카테고리가 없어요.</p>}
        {roots.map((c) => renderItem(c, 0))}
        <button type="button" className="btn small" onClick={add}>
          <i className="fa-solid fa-plus" /> 카테고리 추가
        </button>
      </div>
      <SaveBar dirty={dirty} busy={busy} onSave={save} onReset={() => setList(toDraft(app.categories))} />
    </>
  )
}

/* ------------------------------------------------------------------ */

function PostsTab() {
  const app = useApp()
  const [data, setData] = useState(null)
  const [page, setPage] = useState(1)
  const [type, setType] = useState('all')
  const [visibility, setVisibility] = useState('')
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    setData(null)
    api.posts({ type, visibility, q: query, page, limit: 20, pinned: 0 }).then(setData).catch((e) => app.showToast(e.message))
  }, [type, visibility, query, page])

  async function remove(p) {
    if (!window.confirm(`'${p.title}'을(를) 삭제할까요?`)) return
    try {
      await api.deletePost(p.id)
      setData((d) => ({ ...d, items: d.items.filter((x) => x.id !== p.id) }))
      app.reload()
    } catch (e) {
      app.showToast(e.message)
    }
  }

  const catName = (id) => app.categories.find((c) => c.id === id)?.name || '—'
  return (
    <>
      <div className="list-toolbar wrap">
        <Segmented
          value={type}
          onChange={(v) => {
            setType(v)
            setPage(1)
          }}
          size="small"
          options={[
            { value: 'all', label: '전체' },
            { value: 'post', label: '글' },
            { value: 'notice', label: '공지' },
          ]}
        />
        <select value={visibility} onChange={(e) => setVisibility(e.target.value)} aria-label="공개 범위">
          <option value="">모든 공개 범위</option>
          <option value="public">공개</option>
          <option value="protected">비밀글</option>
          <option value="private">비공개</option>
        </select>
        <form
          className="search-field"
          onSubmit={(e) => {
            e.preventDefault()
            setQuery(q)
            setPage(1)
          }}
        >
          <i className="fa-solid fa-magnifying-glass" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="제목 검색" aria-label="제목 검색" />
        </form>
        <a href="/write" className="btn small primary">
          <i className="fa-solid fa-pen" /> 새 글
        </a>
      </div>
      {!data ? (
        <Spinner />
      ) : data.items.length === 0 ? (
        <Empty title="글이 없어요" />
      ) : (
        <div className="admin-list card">
          {data.items.map((p) => (
            <div className="admin-row" key={p.id}>
              <a href={`/post/${p.id}`} className="admin-row-main">
                <strong>
                  {p.type === 'notice' && <span className="badge">공지</span>}
                  {p.visibility === 'protected' && <i className="fa-solid fa-lock lock-icon" />}
                  {p.visibility === 'private' && <i className="fa-solid fa-eye-slash lock-icon" />}
                  {p.title || '(제목 없음)'}
                </strong>
                <span className="muted">
                  {formatDate(p.publishedAt)} · {catName(p.categoryId)} · 조회 {p.views} · 댓글 {p.commentCount}
                </span>
              </a>
              <a href={`/write/${p.id}`} className="icon-btn small" aria-label="수정">
                <i className="fa-solid fa-pen" />
              </a>
              <button type="button" className="icon-btn small danger" onClick={() => remove(p)} aria-label="삭제">
                <i className="fa-solid fa-trash" />
              </button>
            </div>
          ))}
        </div>
      )}
      {data && <Paging page={data.page} pages={data.pages} onChange={setPage} />}
    </>
  )
}

/* ------------------------------------------------------------------ */

function CommentsTab() {
  const app = useApp()
  const [items, setItems] = useState(null)
  const load = () => api.comments({ recent: 1 }).then((res) => setItems(res.items))
  useEffect(() => {
    load().catch((e) => app.showToast(e.message))
  }, [])

  async function remove(c) {
    if (!window.confirm('삭제할까요? 답글도 함께 지워져요.')) return
    await api.deleteComment(c.id)
    load()
  }

  if (!items) return <Spinner />
  if (!items.length) return <Empty icon="fa-regular fa-comments" title="아직 댓글이나 방명록이 없어요" />
  return (
    <div className="admin-list card">
      {items.map((c) => (
        <div className="admin-row" key={c.id}>
          <a href={c.postId ? `/post/${c.postId}` : '/guestbook'} className="admin-row-main">
            <strong>
              {c.name} {c.secret && <i className="fa-solid fa-lock lock-icon" />} {c.parentId && <span className="badge">답글</span>}
            </strong>
            <span className="comment-text clamp">{c.body}</span>
            <span className="muted">
              {c.postId ? `'${c.postTitle || '삭제된 글'}'의 댓글` : '방명록'} · {formatDateTime(c.createdAt)}
            </span>
          </a>
          <button type="button" className="icon-btn small danger" onClick={() => remove(c)} aria-label="삭제">
            <i className="fa-solid fa-trash" />
          </button>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function BackupTab() {
  const app = useApp()
  const [files, setFiles] = useState(null)
  const [storage, setStorage] = useState(null)
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('all')

  const loadFiles = () =>
    api.files().then((res) => {
      setFiles(res.files)
      setStorage(res.storage)
    })

  useEffect(() => {
    loadFiles().catch((e) => app.showToast(e.message))
  }, [])

  async function removeFile(f) {
    const msg = f.used
      ? '이 파일은 아직 글이나 설정에서 쓰이고 있어요. 지우면 그 자리에서 사진이 깨져 보여요. 그래도 지울까요?'
      : '이 파일을 저장소에서 지울까요? 되돌릴 수 없어요.'
    if (!window.confirm(msg)) return
    try {
      await api.deleteFile(f.key)
      setFiles((list) => list.filter((x) => x.key !== f.key))
      app.showToast('지웠어요.')
    } catch (e) {
      app.showToast(e.message)
    }
  }

  async function cleanup() {
    if (!window.confirm('어디에도 쓰이지 않는 파일을 모두 지울까요? (방금 올리고 아직 저장하지 않은 글의 사진을 지키려고, 하루 지난 파일만 지워요)')) return
    setBusy(true)
    try {
      const res = await api.cleanupFiles(24)
      app.showToast(res.removed ? `${res.removed}개를 지웠어요.` : '지울 파일이 없어요.')
      await loadFiles()
    } catch (e) {
      app.showToast(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function migrate() {
    setBusy(true)
    try {
      let left = storage?.pendingD1 || 0
      for (let i = 0; i < 100 && left > 0; i++) left = (await api.migrateFiles()).remaining
      app.showToast('R2로 모두 옮겼어요.')
      await loadFiles()
    } catch (e) {
      app.showToast(e.message)
    } finally {
      setBusy(false)
    }
  }

  const shown = (files || []).filter((f) => (filter === 'unused' ? !f.used : filter === 'used' ? f.used : true))
  const mb = (b) => (b / 1024 / 1024).toFixed(b > 100 * 1024 * 1024 ? 0 : 1)

  async function importFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!window.confirm('백업을 불러오면 지금 있는 글·설정·댓글이 모두 백업 내용으로 바뀌어요. 계속할까요?')) return
    setBusy(true)
    try {
      await api.importAll(JSON.parse(await file.text()))
      await app.reload()
      app.showToast('백업을 불러왔어요.')
    } catch (err) {
      app.showToast(err.message || '불러오지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="card padded">
        <h2 className="section-title small">백업</h2>
        <p className="muted">글·설정·카테고리·댓글을 JSON 파일 하나로 내려받아요. (업로드한 이미지 파일은 포함되지 않아요)</p>
        <div className="row gap-s wrap">
          <a href={api.exportUrl} className="btn primary" download data-native="">
            <i className="fa-solid fa-download" /> 백업 내려받기
          </a>
          <label className="btn">
            <i className="fa-solid fa-upload" /> {busy ? '불러오는 중...' : '백업 불러오기'}
            <input type="file" accept="application/json,.json" hidden onChange={importFile} disabled={busy} />
          </label>
        </div>
      </div>
      <div className="card padded">
        <h2 className="section-title small">올린 파일</h2>
        {storage && (
          <div className="storage-info">
            <span className={`badge ${storage.r2 ? '' : 'warn'}`}>{storage.r2 ? 'R2 저장소' : 'D1 저장 (R2 미연결)'}</span>
            <span>
              {storage.count}개 · {mb(storage.bytes)}MB {storage.r2 ? '/ 무료 10GB' : ''}
            </span>
            {storage.r2 && storage.pendingD1 > 0 && (
              <button type="button" className="btn small" onClick={migrate} disabled={busy}>
                <i className="fa-solid fa-truck-arrow-right" /> 남은 {storage.pendingD1}개 R2로 옮기기
              </button>
            )}
          </div>
        )}
        <p className="muted file-help">
          글이나 설정에서 사진을 빼거나 글을 지우면, 다른 곳에서 쓰지 않는 파일은 저장소에서도 자동으로 지워져요. 아래에서 직접 지울 수도 있어요.
        </p>
        <div className="list-toolbar wrap">
          <div className="segmented small">
            {[
              ['all', '전체'],
              ['used', '사용 중'],
              ['unused', '안 쓰는 파일'],
            ].map(([v, l]) => (
              <button type="button" key={v} className={filter === v ? 'active' : ''} onClick={() => setFilter(v)}>
                {l}
              </button>
            ))}
          </div>
          <button type="button" className="btn small ghost danger" onClick={cleanup} disabled={busy}>
            <i className="fa-solid fa-broom" /> 안 쓰는 파일 정리
          </button>
        </div>
        {!files ? (
          <Spinner />
        ) : shown.length === 0 ? (
          <p className="muted">파일이 없어요.</p>
        ) : (
          <div className="file-grid">
            {shown.map((f) => (
              <div key={f.key} className={`file-cell ${f.used ? '' : 'unused'}`}>
                <button
                  type="button"
                  className="file-thumb"
                  title="주소 복사"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(location.origin + f.url)
                      app.showToast('주소를 복사했어요.')
                    } catch {
                      window.prompt('주소', location.origin + f.url)
                    }
                  }}
                >
                  {f.mime.startsWith('image/') ? <img src={f.url} alt="" loading="lazy" /> : <i className="fa-regular fa-file" />}
                </button>
                <span className="file-size">{(f.size / 1024).toFixed(0)}KB</span>
                {!f.used && <span className="file-flag">안 씀</span>}
                <button type="button" className="file-del" onClick={() => removeFile(f)} aria-label="파일 지우기">
                  <i className="fa-solid fa-trash" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
