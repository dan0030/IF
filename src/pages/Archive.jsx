import React, { useEffect, useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { api } from '../lib/api.js'
import { navigate } from '../lib/router.js'
import { formatDate } from '../lib/format.js'
import { LargeTitle } from '../components/Shell.jsx'
import { PostList } from '../components/PostList.jsx'
import { Empty, Paging, Spinner } from '../components/ui.jsx'
import { ThreadFeed } from '../components/Thread.jsx'
import PairPage from './PairPage.jsx'
import RpPage from './RpPage.jsx'
import { perPageFor } from '../lib/defaults.js'


// 전체 / 카테고리 / 태그 / 검색 / 공지 목록을 모두 이 화면이 그려요.
export default function Archive({ kind, param, search }) {
  const app = useApp()
  const sp = new URLSearchParams(search)
  const page = Number(sp.get('page')) || 1
  const q = sp.get('q') || ''
  const date = sp.get('date') || ''
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState(q)
  const category = kind === 'category' ? app.categories.find((c) => c.slug === param) : null
  const isThread = category?.page_type === 'thread' && !date
  const isPair = category?.page_type === 'pair'
  const isRp = category?.page_type === 'rp' && !date
  // 목록 모양은 관리자가 정한 것 하나로만 보여줘요. (카테고리 설정 > 디자인 › 목록 기본값)
  const style = kind === 'notice' ? app.theme.noticeStyle || 'list' : category?.list_style || app.theme.listStyle
  const perPage = perPageFor(app.site, app.theme, style)

  useEffect(() => {
    setQuery(q)
  }, [q])

  useEffect(() => {
    if (kind === 'search' && !q) {
      setData({ items: [], total: 0, page: 1, pages: 1 })
      return
    }
    if (isThread || isPair || isRp) return
    let alive = true
    setData(null)
    setError(null)
    const params = { page, limit: perPage }
    if (kind === 'category') params.category = param
    if (kind === 'tag') params.tag = param
    if (kind === 'search') params.q = q
    if (kind === 'notice') params.type = 'notice'
    if (date) params.date = date
    api
      .posts(params)
      .then((res) => alive && setData(res))
      .catch((e) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [kind, param, q, page, date, perPage, isThread, isPair, isRp])

  let title = '전체 기록'
  let subtitle = data ? `${data.total}개의 글` : ''
  if (kind === 'category') {
    title = category?.name || param
    subtitle = category?.description || subtitle
  }
  if (kind === 'tag') title = `#${param}`
  if (kind === 'search') title = q ? `'${q}' 검색 결과` : '검색'
  if (kind === 'notice') title = '공지사항'
  if (date) title = formatDate(date, date.length === 10 ? 'long' : 'dot')

  useEffect(() => {
    if (isPair || isRp) return // 페어·역극 페이지는 스스로 제목을 정해요
    document.title = `${title} :: ${app.site.title}`
  }, [title, app.site.title, isPair, isRp])

  function goPage(n) {
    const next = new URLSearchParams(search)
    next.set('page', String(n))
    navigate(`${window.location.pathname}?${next.toString()}`)
  }


  const subCats = category ? app.categories.filter((c) => c.parent_id === category.id) : []

  if (isPair) return <PairPage category={category} search={search} />
  if (isRp) return <RpPage key={category.id} category={category} search={search} />

  return (
    <div className="archive">
      <LargeTitle
        pageKey={!date && (kind === 'archive' || kind === 'notice' || (kind === 'search' && !q)) ? kind : undefined}
        title={title}
        subtitle={subtitle}
        eyebrow={kind === 'category' && category?.icon ? <i className={category.icon} /> : null}>
        {kind === 'search' && (
          <form
            className="search-field big"
            onSubmit={(e) => {
              e.preventDefault()
              if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`)
            }}
          >
            <i className="fa-solid fa-magnifying-glass" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="제목이나 내용으로 찾기" autoFocus aria-label="검색어" />
          </form>
        )}
      </LargeTitle>

      {subCats.length > 0 && (
        <div className="chip-row">
          {subCats.map((c) => (
            <a key={c.id} href={`/category/${encodeURIComponent(c.slug)}`} className="chip">
              {c.icon && <i className={c.icon} />} {c.name}
            </a>
          ))}
        </div>
      )}

      {isThread ? (
        <ThreadFeed category={category} search={search} />
      ) : (
        <>
      <div className="list-toolbar">
        <span className="list-count">{data ? `${data.total}개` : ''}</span>
      </div>

      {error ? (
        <Empty title="불러오지 못했어요">{error}</Empty>
      ) : !data ? (
        <Spinner />
      ) : data.items.length === 0 ? (
        <Empty icon={kind === 'search' ? 'fa-solid fa-magnifying-glass' : 'fa-regular fa-folder-open'} title={kind === 'search' && q ? '검색 결과가 없습니다.' : '아직 글이 없어요.'}>
          {kind === 'search' && q ? '다른 검색어로 다시 시도해보세요.' : app.admin ? '오른쪽 위 연필 버튼으로 첫 글을 써보세요.' : null}
        </Empty>
      ) : (
        <PostList items={data.items} style={style} />
      )}
      {data && <Paging page={data.page} pages={data.pages} onChange={goPage} />}
        </>
      )}
    </div>
  )
}
