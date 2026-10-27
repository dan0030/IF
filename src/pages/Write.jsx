import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { api } from '../lib/api.js'
import { navigate } from '../lib/router.js'
import { pad } from '../lib/format.js'
import { useTopbarTitle } from '../components/Shell.jsx'
import { ImageInput } from '../components/Fields.jsx'
import { Content } from '../components/Content.jsx'
import { Empty, Segmented, Spinner, Switch } from '../components/ui.jsx'
import { RichEditor } from '../editor/RichEditor.jsx'
import { RpWriteFields, charsOf, useCategoryConfig } from './RpPage.jsx'
import { RpScriptEditor, RpScriptView, isScript } from '../components/RpScript.jsx'

function nowLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const EMPTY = {
  type: 'post',
  title: '',
  content: '',
  format: 'rich',
  categoryId: '',
  tags: [],
  visibility: 'public',
  password: '',
  pinned: false,
  allowComments: true,
  thumbnail: '',
  excerpt: '',
  publishedAt: '',
  extra: { subtitle: '', cover: '', hint: '' },
}

export default function Write({ id }) {
  const app = useApp()
  const draftKey = `od-draft-${id || 'new'}`
  const [post, setPost] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [hasPassword, setHasPassword] = useState(false)
  const dirty = useRef(false)

  useTopbarTitle(id ? '글 수정' : '새 글')

  useEffect(() => {
    if (!app.admin) return
    let saved = null
    try {
      saved = JSON.parse(localStorage.getItem(draftKey) || 'null')
    } catch {
      saved = null
    }
    if (!id) {
      const base = { ...EMPTY, publishedAt: nowLocal() }
      const sp = new URLSearchParams(window.location.search)
      if (sp.get('type') === 'notice') base.type = 'notice'
      if (sp.get('category')) base.categoryId = Number(sp.get('category'))
      if (saved && window.confirm('임시저장된 글이 있어요. 이어서 쓸까요?')) setPost({ ...base, ...saved })
      else setPost(base)
      return
    }
    api
      .post(id)
      .then((p) => {
        if (p.replyOf) {
          navigate(`/post/${p.replyOf}#reply-${p.id}`, { replace: true })
          return
        }
        const loaded = {
          type: p.type,
          title: p.title,
          content: p.content || '',
          format: p.format || 'rich',
          categoryId: p.categoryId || '',
          tags: p.tags || [],
          visibility: p.visibility,
          password: '',
          pinned: p.pinned,
          allowComments: p.allowComments,
          thumbnail: p.thumbnail || '',
          excerpt: '',
          publishedAt: (p.publishedAt || '').slice(0, 16),
          extra: { ...EMPTY.extra, ...(p.extra || {}) },
          author: p.author || 'me',
          baseUpdatedAt: p.updatedAt,
        }
        setHasPassword(p.visibility === 'protected')
        if (saved && saved.baseUpdatedAt === p.updatedAt && window.confirm('이 글을 고치던 임시저장본이 있어요. 불러올까요?')) setPost({ ...loaded, ...saved })
        else setPost(loaded)
      })
      .catch((e) => setError(e.message))
  }, [id, app.admin])

  // 1초마다 브라우저에 임시저장합니다.
  useEffect(() => {
    if (!post || !dirty.current) return
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ ...post, password: '' }))
      } catch {
        // 저장 공간이 부족하면 건너뜀
      }
    }, 1000)
    return () => clearTimeout(t)
  }, [post, draftKey])

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (dirty.current) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  // 역극 로그 카테고리면 일반 에디터 대신 대사·지문 대본 편집기를 써요
  const rpCategory = post && post.type === 'post' ? app.categories.find((c) => c.id === Number(post.categoryId) && c.page_type === 'rp') : null
  const [rpConfig] = useCategoryConfig(rpCategory?.id || null)
  const rpChars = charsOf(rpConfig, app.site)
  const useScript = !!rpCategory && (!post?.content?.replace(/<[^>]+>|\s|&nbsp;/g, '') || isScript(post?.content))

  if (!app.admin) return <Empty icon="fa-solid fa-lock" title="로그인이 필요해요"><a href="/login" className="btn primary">로그인</a></Empty>
  if (error) return <Empty title="글을 불러오지 못했어요">{error}</Empty>
  if (!post) return <Spinner />

  const set = (patch) => {
    dirty.current = true
    setPost((p) => ({ ...p, ...patch }))
  }
  const setExtra = (patch) => {
    dirty.current = true
    setPost((p) => ({ ...p, extra: { ...p.extra, ...patch } }))
  }

  function addTags(text) {
    const next = text
      .split(/[,\s]+/)
      .map((t) => t.replace(/^#/, '').trim())
      .filter(Boolean)
    if (next.length) set({ tags: [...new Set([...post.tags, ...next])] })
    setTagInput('')
  }

  async function save() {
    const threadCat = app.categories.find((c) => c.id === Number(post.categoryId))?.page_type === 'thread'
    if (!post.title.trim() && !threadCat) {
      app.showToast('제목을 적어주세요.')
      return
    }
    if (post.visibility === 'protected' && !post.password && !hasPassword) {
      app.showToast('비밀글 비밀번호를 정해주세요.')
      return
    }
    setSaving(true)
    try {
      const payload = { ...post, tags: tagInput.trim() ? [...post.tags, ...tagInput.split(/[,\s]+/).filter(Boolean)] : post.tags }
      const res = id ? await api.updatePost(id, payload) : await api.createPost(payload)
      dirty.current = false
      localStorage.removeItem(draftKey)
      app.showToast(id ? '수정했어요.' : '발행했어요.')
      app.reload()
      navigate(`/post/${res.id}`, { replace: true })
    } catch (e) {
      app.showToast(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="write">
      <div className="write-head">
        <Segmented
          value={post.type}
          onChange={(v) => set({ type: v })}
          options={[
            { value: 'post', label: '글', icon: 'fa-regular fa-file-lines' },
            { value: 'notice', label: '공지', icon: 'fa-solid fa-bullhorn' },
          ]}
        />
        <button type="button" className={`btn small ${preview ? 'primary' : ''}`} onClick={() => setPreview((v) => !v)}>
          <i className="fa-regular fa-eye" /> {preview ? '미리보기 닫기' : '미리보기'}
        </button>
      </div>

      <input className="write-title" value={post.title} onChange={(e) => set({ title: e.target.value })} placeholder="제목" aria-label="제목" maxLength={200} />
      <input className="write-subtitle" value={post.extra.subtitle || ''} onChange={(e) => setExtra({ subtitle: e.target.value })} placeholder="부제 (선택)" aria-label="부제" />

      {preview ? (
        <article className="article card">
          <header className="article-header">
            <h1 className="article-title">{post.title || '(제목 없음)'}</h1>
            {post.extra.subtitle && <p className="article-subtitle">{post.extra.subtitle}</p>}
          </header>
          {isScript(post.content) ? <RpScriptView html={post.content} chars={rpChars} bubble={rpConfig?.bubble} /> : <Content html={post.content} />}
        </article>
      ) : useScript ? (
        rpConfig ? (
          <RpScriptEditor
            key={post.id || 'new'}
            value={post.content}
            onChange={(html) => set({ content: html, format: 'rich' })}
            chars={rpChars}
            cast={post.extra.rpCast}
            quote={post.extra.rpQuote}
            onQuote={(q) => setExtra({ rpQuote: q })}
          />
        ) : (
          <Spinner />
        )
      ) : (
        <>
          {rpCategory && <p className="field-help">예전 방식(일반 글)으로 쓴 역극이에요. 본문을 비우면 대사·지문 대본 편집기로 바뀌어요.</p>}
          <RichEditor value={post.content} onChange={(html) => set({ content: html })} mode={post.format} onModeChange={(m) => set({ format: m })} />
        </>
      )}

      <section className="write-options card">
        <h2 className="section-title small">발행 설정</h2>
        <div className="fields">
          {post.type === 'post' && (
            <div className="field">
              <label className="field-label" htmlFor="w-cat">
                카테고리
              </label>
              <select id="w-cat" value={post.categoryId || ''} onChange={(e) => set({ categoryId: e.target.value ? Number(e.target.value) : '' })}>
                <option value="">카테고리 없음</option>
                {app.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.parent_id ? '└ ' : ''}
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {post.type === 'post' && app.categories.find((c) => c.id === Number(post.categoryId))?.page_type === 'rp' && (
            <RpWriteFields key={post.categoryId} config={rpConfig} chars={rpChars} extra={post.extra} setExtra={setExtra} />
          )}

          <div className="field">
            <label className="field-label" htmlFor="w-tags">
              태그
            </label>
            <div className="tag-input">
              {post.tags.map((t) => (
                <span key={t} className="chip">
                  #{t}
                  <button type="button" onClick={() => set({ tags: post.tags.filter((x) => x !== t) })} aria-label={`${t} 태그 지우기`}>
                    <i className="fa-solid fa-xmark" />
                  </button>
                </span>
              ))}
              <input
                id="w-tags"
                value={tagInput}
                onChange={(e) => {
                  if (/[,\s]$/.test(e.target.value)) addTags(e.target.value)
                  else setTagInput(e.target.value)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTags(tagInput)
                  } else if (e.key === 'Backspace' && !tagInput && post.tags.length) set({ tags: post.tags.slice(0, -1) })
                }}
                onBlur={() => tagInput && addTags(tagInput)}
                placeholder="#태그 입력 후 엔터"
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="w-date">
              기록 날짜
            </label>
            <input id="w-date" type="datetime-local" value={post.publishedAt} onChange={(e) => set({ publishedAt: e.target.value })} />
            <p className="field-help">캘린더와 목록은 이 날짜를 기준으로 정리돼요. 지난 이야기도 그날 날짜로 남길 수 있어요.</p>
          </div>

          <div className="field">
            <span className="field-label">공개 범위</span>
            <Segmented
              value={post.visibility}
              onChange={(v) => set({ visibility: v })}
              options={[
                { value: 'public', label: '공개', icon: 'fa-solid fa-globe' },
                { value: 'protected', label: '비밀글', icon: 'fa-solid fa-lock' },
                { value: 'private', label: '비공개', icon: 'fa-solid fa-eye-slash' },
              ]}
            />
            <p className="field-help">비밀글은 비밀번호를 아는 사람만 열어볼 수 있고, 비공개는 관리자만 볼 수 있어요.</p>
          </div>
          {post.visibility === 'protected' && (
            <>
              <div className="field">
                <label className="field-label" htmlFor="w-pw">
                  비밀글 비밀번호
                </label>
                <input
                  id="w-pw"
                  type="text"
                  value={post.password}
                  onChange={(e) => set({ password: e.target.value })}
                  placeholder={hasPassword ? '바꿀 때만 입력 (비우면 기존 비밀번호 유지)' : '비밀번호'}
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="w-hint">
                  비밀번호 힌트
                </label>
                <input id="w-hint" value={post.extra.hint || ''} onChange={(e) => setExtra({ hint: e.target.value })} placeholder="예: 우리가 처음 만난 날 (4자리)" />
              </div>
            </>
          )}

          <div className="field">
            <span className="field-label">글쓴이 (타임라인 타래에서 보여요)</span>
            <Segmented
              value={post.author || 'me'}
              onChange={(v) => set({ author: v })}
              options={[
                { value: 'me', label: app.site.pair.me.name || '나' },
                { value: 'partner', label: app.site.pair.partner.name || '상대' },
              ]}
            />
          </div>
          <div className="field">
            <span className="field-label">타임라인 날짜 표시 (세계관 날짜)</span>
            <div className="tl-date-inputs">
              <input value={post.extra.tlGroup || ''} onChange={(e) => setExtra({ tlGroup: e.target.value })} placeholder="큰 구분 · 예: 제국력 312년 / 1부" aria-label="타임라인 큰 구분" maxLength={40} />
              <input value={post.extra.tlLabel || ''} onChange={(e) => setExtra({ tlLabel: e.target.value })} placeholder="날짜 · 예: 봄 3일 / D-7" aria-label="타임라인 날짜" maxLength={30} />
            </div>
            <p className="field-help">타임라인 보기에서 실제 날짜 대신 이 문구가 보여요. 비우면 기록 날짜(예: 2026. 10 / 10.9)를 써요. 순서는 위의 기록 날짜 순서를 따라요.</p>
          </div>
          <div className="field">
            <Switch
              checked={!post.extra.hideExcerpt}
              onChange={(v) => setExtra({ hideExcerpt: !v })}
              label="목록에 요약(미리보기) 보이기"
              description="끄면 목록·카드·메모 등에서 제목만 보여요."
            />
          </div>
          <div className="field">
            <Switch checked={post.pinned} onChange={(v) => set({ pinned: v })} label="목록 맨 위에 고정" />
          </div>
          <div className="field">
            <Switch checked={post.allowComments} onChange={(v) => set({ allowComments: v })} label="댓글 허용" />
          </div>

          <details className="more-options">
            <summary>더 보기 (대표 이미지 · 커버 · 요약)</summary>
            <div className="field">
              <span className="field-label">대표 이미지 (비우면 본문 첫 사진)</span>
              <ImageInput value={post.thumbnail} onChange={(v) => set({ thumbnail: v })} guide="thumbnail" />
            </div>
            <div className="field">
              <span className="field-label">글 상단 커버 이미지</span>
              <ImageInput value={post.extra.cover || ''} onChange={(v) => setExtra({ cover: v })} guide="postCover" />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="w-excerpt">
                목록에 보일 요약 (비우면 자동)
              </label>
              <textarea id="w-excerpt" rows={2} value={post.excerpt} onChange={(e) => set({ excerpt: e.target.value })} maxLength={180} />
            </div>
          </details>
        </div>
      </section>

      <div className="write-bar">
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            if (!dirty.current || window.confirm('저장하지 않은 내용은 임시저장본으로만 남아요. 나갈까요?')) {
              dirty.current = false
              window.history.back()
            }
          }}
        >
          나가기
        </button>
        <span className="write-bar-status">{dirty.current ? '브라우저에 자동 임시저장 중' : ''}</span>
        <button type="button" className="btn primary" onClick={save} disabled={saving}>
          {saving ? '저장 중...' : id ? '수정하기' : '발행하기'}
        </button>
      </div>
    </div>
  )
}
