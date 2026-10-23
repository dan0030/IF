import React, { useEffect, useMemo, useRef, useState } from 'react'
import { swapNames, useApp } from '../lib/store.jsx'
import { uid } from '../lib/format.js'
import { Sheet } from './ui.jsx'

// 역극 대본: '대사'(캐릭터 두상 + 말풍선), '지문'(소설체 행동 묘사), '구분선'(장면 전환) 블록을 차례로 쌓아요.
// 저장은 아래 모양의 HTML로 해서, 검색·백업·요약이 일반 글처럼 동작해요.
//   <div class="rp-script">
//     <div class="rp-say" data-char="키" data-ava="/files/…"><b class="rp-who">이름</b><div class="rp-text">대사<br>…</div></div>
//     <div class="rp-act"><p>지문</p><p>…</p></div>
//     <div class="rp-hr"><span>장면 전환 (선택)</span></div>
//   </div>
// 두상 이미지는 볼 때 페이지 설정의 최신 이미지로 다시 그려요. (data-ava는 예전 이미지 대신용)
//
// 대사·지문 안의 글자 꾸밈은 편집할 때 짧은 표시로 적고, 저장할 때 HTML 태그로 바꿔요.
//   [b]굵게[/b] [i]기울임[/i] [u]밑줄[/u] [s]취소선[/s] [dot]방점[/dot] [color=#e5484d]글자색[/color]
//   루비: [ruby=かんじ]漢字[/ruby] 또는 웹소설식 |漢字《かんじ》
// 역극에서 자주 쓰는 *행동* 표기와 겹치지 않게 대괄호 표시를 써요.

export function isScript(html) {
  return /class="rp-script"/.test(html || '')
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const INLINE_TAGS = { b: ['<b>', '</b>'], i: ['<i>', '</i>'], u: ['<u>', '</u>'], s: ['<s>', '</s>'], dot: ['<em class="rp-dot">', '</em>'] }

// 꾸밈 표시가 들어간 글 → 안전한 HTML (글은 전부 이스케이프하고, 정해진 태그만 넣어요)
export function inlineHtml(text) {
  let h = esc(text)
  h = h.replace(/[|｜]([^|｜《\n]{1,40})《([^》\n]{1,40})》/g, '<ruby>$1<rt>$2</rt></ruby>')
  h = h.replace(/\[ruby=([^\]\n]{1,40})\]([\s\S]*?)\[\/ruby\]/g, '<ruby>$2<rt>$1</rt></ruby>')
  // 안쪽부터 바뀌도록 더 이상 바뀌지 않을 때까지 되풀이해요. (겹쳐 꾸민 글)
  for (let k = 0; k < 8; k++) {
    const before = h
    h = h.replace(/\[(b|i|u|s|dot)\]((?:(?!\[\1\])[\s\S])*?)\[\/\1\]/g, (_, t, inner) => INLINE_TAGS[t][0] + inner + INLINE_TAGS[t][1])
    h = h.replace(/\[color=(#[0-9a-fA-F]{3,8})\]((?:(?!\[color=)[\s\S])*?)\[\/color\]/g, '<span style="color:$1">$2</span>')
    if (h === before) break
  }
  return h
}

const MARKUP_RE = /\[(b|i|u|s|dot|color=#[0-9a-fA-F]{3,8}|ruby=[^\]]+)\]|[|｜][^|｜《\n]+《[^》\n]+》/

// 저장된 HTML → 편집용 꾸밈 표시가 들어간 글
function markupOf(el) {
  if (!el) return ''
  let out = ''
  for (const node of el.childNodes) {
    if (node.nodeType === 3) {
      out += node.textContent
      continue
    }
    if (node.nodeType !== 1) continue
    const tag = node.tagName.toLowerCase()
    const inner = () => markupOf(node)
    if (tag === 'br') out += '\n'
    else if (tag === 'b' || tag === 'strong') out += `[b]${inner()}[/b]`
    else if (tag === 'em' && node.classList.contains('rp-dot')) out += `[dot]${inner()}[/dot]`
    else if (tag === 'i' || tag === 'em') out += `[i]${inner()}[/i]`
    else if (tag === 'u') out += `[u]${inner()}[/u]`
    else if (tag === 's' || tag === 'del' || tag === 'strike') out += `[s]${inner()}[/s]`
    else if (tag === 'ruby') {
      const rt = [...node.querySelectorAll('rt')].map((r) => r.textContent).join('')
      const base = [...node.childNodes].filter((c) => !(c.nodeType === 1 && /^(rt|rp)$/i.test(c.tagName))).map((c) => (c.nodeType === 1 ? markupOf(c) : c.textContent)).join('')
      out += `[ruby=${rt}]${base}[/ruby]`
    } else if (tag === 'span' && /^#[0-9a-f]{3,8}$/i.test(node.style.color ? toHexColor(node.style.color) : '')) out += `[color=${toHexColor(node.style.color)}]${inner()}[/color]`
    else out += inner()
  }
  return out
}

function toHexColor(c) {
  if (/^#/.test(c)) return c
  const m = c.match(/\d+/g)
  return m && m.length >= 3 ? `#${m.slice(0, 3).map((v) => Number(v).toString(16).padStart(2, '0')).join('')}` : ''
}

// 화면에 보일 HTML: 꾸밈을 태그로 바꾸고 이름 변환({{나}} 등)을 해요.
function displayHtml(text, site) {
  return swapNames(inlineHtml(text || '').replace(/\n/g, '<br>'), site)
}

export function scriptToHtml(blocks, chars) {
  const map = Object.fromEntries((chars || []).map((c) => [c.key, c]))
  const body = blocks
    .filter((b) => b.type === 'hr' || (b.text || '').trim())
    .map((b) => {
      if (b.type === 'hr') {
        const label = (b.text || '').trim()
        return `<div class="rp-hr">${label ? `<span>${inlineHtml(label)}</span>` : ''}</div>`
      }
      if (b.type === 'say') {
        const c = map[b.char] || {}
        const name = c.name || b.name || ''
        return `<div class="rp-say" data-char="${esc(b.char)}"${c.avatar ? ` data-ava="${esc(c.avatar)}"` : ''}><b class="rp-who">${esc(name)}</b><div class="rp-text">${inlineHtml(b.text.trim()).replace(/\n/g, '<br>')}</div></div>`
      }
      const paras = b.text
        .trim()
        .split(/\n{2,}/)
        .map((p) => `<p>${inlineHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
        .join('')
      return `<div class="rp-act">${paras}</div>`
    })
    .join('\n')
  return `<div class="rp-script">\n${body}\n</div>`
}

function textOf(el) {
  if (!el) return ''
  const clone = el.cloneNode(true)
  clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'))
  return clone.textContent
}

export function parseScript(html) {
  if (!isScript(html)) return []
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const root = doc.querySelector('.rp-script')
  if (!root) return []
  return [...root.children]
    .map((el) => {
      if (el.classList.contains('rp-say')) {
        return { id: uid('b'), type: 'say', char: el.dataset.char || '', name: textOf(el.querySelector('.rp-who')), ava: el.dataset.ava || '', text: markupOf(el.querySelector('.rp-text')) }
      }
      if (el.classList.contains('rp-hr')) {
        return { id: uid('b'), type: 'hr', text: markupOf(el.querySelector('span')) }
      }
      if (el.classList.contains('rp-act')) {
        const ps = [...el.querySelectorAll('p')]
        return { id: uid('b'), type: 'act', text: ps.length ? ps.map(markupOf).join('\n\n') : markupOf(el) }
      }
      return null
    })
    .filter(Boolean)
}

/* ---------------- 보기 ---------------- */

export function Avatar({ char, size = 44 }) {
  const name = char?.name || '?'
  return (
    <span className="rp-ava" style={{ width: size, height: size, ...(char?.color ? { '--cc': char.color } : {}) }}>
      {char?.avatar ? <img src={char.avatar} alt="" loading="lazy" /> : <span>{name.slice(0, 1)}</span>}
    </span>
  )
}

export function SayLine({ char, text, compact = false }) {
  const { site } = useApp()
  return (
    <div className={`rp-say-row ${char?.side === 'right' ? 'right' : 'left'} ${compact ? 'compact' : ''}`} style={char?.color ? { '--cc': char.color } : undefined}>
      <Avatar char={char} size={compact ? 34 : 46} />
      <div className="rp-say-body">
        <span className="rp-say-name">{char?.name}</span>
        <div className="rp-bubble" dangerouslySetInnerHTML={{ __html: displayHtml(text, site) }} />
      </div>
    </div>
  )
}

export function RpScriptView({ html, chars }) {
  const { site } = useApp()
  const blocks = useMemo(() => parseScript(html), [html])
  const map = useMemo(() => Object.fromEntries((chars || []).map((c) => [c.key, c])), [chars])
  return (
    <div className="rp-script-view">
      {blocks.map((b) =>
        b.type === 'hr' ? (
          <Divider key={b.id} html={b.text ? displayHtml(b.text, site) : ''} />
        ) : b.type === 'say' ? (
          <SayLine key={b.id} char={map[b.char] || { name: b.name, avatar: b.ava }} text={b.text} />
        ) : (
          <div key={b.id} className="rp-act-view">
            {b.text.split(/\n{2,}/).map((p, i) => (
              <p key={i} dangerouslySetInnerHTML={{ __html: displayHtml(p, site) }} />
            ))}
          </div>
        ),
      )}
    </div>
  )
}

// 장면을 나누는 구분선. 글을 적으면 선 가운데에 보여요.
function Divider({ html }) {
  return (
    <div className={`rp-hr ${html ? 'has-text' : ''}`} role="separator">
      {html ? <span dangerouslySetInnerHTML={{ __html: html }} /> : null}
    </div>
  )
}

/* ---------------- 편집 ---------------- */

function AutoText({ value, onChange, placeholder, className, autoFocus, inputRef, onFocus, onKeyDown }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [value])
  return (
    <textarea
      ref={(el) => {
        ref.current = el
        if (inputRef) inputRef(el)
      }}
      rows={1}
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      autoFocus={autoFocus}
    />
  )
}

/* ---------------- 글자 꾸밈 도구 ---------------- */

const FORMAT_COLORS = ['#e5484d', '#f76b15', '#d6a000', '#30a46c', '#0090ff', '#8e4ec6', '#e93d82', '#8b8d98']

// 선택한 글을 꾸밈 표시로 감싸요. 꾸밈이 끝나면 감싼 글이 다시 선택된 채로 둬요.
function wrapSelection(el, open, close, setText) {
  if (!el) return
  const { selectionStart: s, selectionEnd: e, value } = el
  setText(value.slice(0, s) + open + value.slice(s, e) + close + value.slice(e))
  requestAnimationFrame(() => {
    el.focus()
    el.setSelectionRange(s + open.length, e + open.length)
  })
}

function clearSelection(el, setText) {
  if (!el) return
  const { selectionStart: s, selectionEnd: e, value } = el
  const strip = (t) =>
    t
      .replace(/\[\/?(b|i|u|s|dot)\]|\[color=[^\]]*\]|\[\/color\]|\[\/ruby\]/g, '')
      .replace(/\[ruby=[^\]]*\]/g, '')
      .replace(/[|｜]([^|｜《\n]+)《[^》\n]+》/g, '$1')
  // 아무것도 선택하지 않았으면 블록 전체의 꾸밈을 지워요.
  if (s === e) setText(strip(value))
  else setText(value.slice(0, s) + strip(value.slice(s, e)) + value.slice(e))
  requestAnimationFrame(() => el.focus())
}

function FormatBar({ el, setText }) {
  const [colorsOpen, setColorsOpen] = useState(false)
  const customRef = useRef(null)
  const keep = (e) => e.preventDefault() // 버튼을 눌러도 글칸의 선택이 풀리지 않게
  const wrap = (open, close) => wrapSelection(el, open, close, setText)
  function ruby() {
    if (!el) return
    const picked = el.value.slice(el.selectionStart, el.selectionEnd)
    const base = picked || window.prompt('루비를 달 글자를 적어주세요', '')
    if (!base) return
    const rt = window.prompt(`'${base}' 위에 작게 달 글(루비)을 적어주세요`, '')
    if (!rt) return
    const { selectionStart: s, selectionEnd: e, value } = el
    const piece = `[ruby=${rt.replace(/[\]\n]/g, '')}]${base}[/ruby]`
    setText(value.slice(0, s) + piece + value.slice(e))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(s + piece.length, s + piece.length)
    })
  }
  // 직접 고르는 색은 색 창을 닫을 때 한 번만 넣어요.
  useEffect(() => {
    const input = customRef.current
    if (!input) return
    const onPick = () => {
      wrap(`[color=${input.value}]`, '[/color]')
      setColorsOpen(false)
    }
    input.addEventListener('change', onPick)
    return () => input.removeEventListener('change', onPick)
  })
  const tools = [
    ['b', 'fa-solid fa-bold', '굵게 (Ctrl+B)'],
    ['i', 'fa-solid fa-italic', '기울임 (Ctrl+I)'],
    ['u', 'fa-solid fa-underline', '밑줄 (Ctrl+U)'],
    ['s', 'fa-solid fa-strikethrough', '취소선'],
    ['dot', 'fa-solid fa-ellipsis', '방점 (글자 위 점)'],
  ]
  return (
    <div className="rp-format-bar" role="toolbar" aria-label="글자 꾸미기" onMouseDown={keep}>
      {tools.map(([t, icon, label]) => (
        <button type="button" key={t} onClick={() => wrap(`[${t}]`, `[/${t}]`)} title={label} aria-label={label}>
          <i className={icon} />
        </button>
      ))}
      <button type="button" onClick={() => setColorsOpen((v) => !v)} title="글자색" aria-label="글자색" aria-expanded={colorsOpen} className={colorsOpen ? 'active' : ''}>
        <i className="fa-solid fa-palette" />
      </button>
      <button type="button" onClick={ruby} title="루비 (글자 위 작은 글) · |漢字《かんじ》로 적어도 돼요" aria-label="루비" className="rp-ruby-btn">
        <ruby>
          字<rt>じ</rt>
        </ruby>
      </button>
      <button type="button" onClick={() => clearSelection(el, setText)} title="꾸밈 지우기 (선택한 곳, 없으면 블록 전체)" aria-label="꾸밈 지우기">
        <i className="fa-solid fa-text-slash" />
      </button>
      {colorsOpen && (
        <div className="rp-format-colors">
          {FORMAT_COLORS.map((c) => (
            <button
              type="button"
              key={c}
              style={{ background: c }}
              onClick={() => {
                wrap(`[color=${c}]`, '[/color]')
                setColorsOpen(false)
              }}
              aria-label={`글자색 ${c}`}
              title={c}
            />
          ))}
          <label className="rp-format-custom" title="직접 고르기">
            <i className="fa-solid fa-eye-dropper" />
            <input ref={customRef} type="color" defaultValue="#e5484d" aria-label="글자색 직접 고르기" />
          </label>
        </div>
      )}
    </div>
  )
}

// 꾸밈이 들어간 블록은 글칸 아래에 실제로 보일 모습을 작게 보여줘요.
function InlinePreview({ text }) {
  const { site } = useApp()
  if (!MARKUP_RE.test(text || '')) return null
  return <div className="rp-inline-preview" aria-label="미리보기" dangerouslySetInnerHTML={{ __html: displayHtml(text, site) }} />
}

export function RpScriptEditor({ value, onChange, chars, cast, quote, onQuote }) {
  const [blocks, setBlocks] = useState(() => {
    const parsed = parseScript(value)
    return parsed.length ? parsed : []
  })
  const [focusId, setFocusId] = useState(null)
  const [activeId, setActiveId] = useState(null) // 꾸밈 도구를 보여줄(마지막으로 누른) 블록
  const [importing, setImporting] = useState(false)
  const inputs = useRef({})
  const speakers = (cast?.length ? chars.filter((c) => cast.includes(c.key)) : chars) || []
  const map = Object.fromEntries(chars.map((c) => [c.key, c]))

  // 블록이 바뀌면 HTML로 바꿔서 올려보내요.
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    onChange(scriptToHtml(blocks, chars))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks])

  const update = (id, patch) => setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  const remove = (id) => setBlocks((bs) => bs.filter((b) => b.id !== id))
  const move = (i, d) =>
    setBlocks((bs) => {
      const j = i + d
      if (j < 0 || j >= bs.length) return bs
      const next = [...bs]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  const insert = (at, block) => {
    const b = { id: uid('b'), text: '', ...block }
    setBlocks((bs) => [...bs.slice(0, at), b, ...bs.slice(at)])
    setFocusId(b.id)
  }

  // 글칸 공통: 꾸밈 도구·단축키(Ctrl+B/I/U)·미리보기
  const textProps = (b) => ({
    inputRef: (el) => (inputs.current[b.id] = el),
    onFocus: () => setActiveId(b.id),
    onKeyDown: (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return
      const t = { b: 'b', i: 'i', u: 'u' }[e.key.toLowerCase()]
      if (!t) return
      e.preventDefault()
      wrapSelection(e.currentTarget, `[${t}]`, `[/${t}]`, (text) => update(b.id, { text }))
    },
  })
  const formatting = (b) =>
    activeId === b.id ? <FormatBar el={inputs.current[b.id]} setText={(text) => update(b.id, { text })} /> : null

  // 다음 대사는 직전에 말하지 않은 사람으로 (두 사람이 번갈아 말하는 경우가 많아서)
  function nextSpeaker(at) {
    const prev = [...blocks.slice(0, at)].reverse().find((b) => b.type === 'say')
    if (!prev) return speakers[0]?.key || ''
    return speakers.find((s) => s.key !== prev.char)?.key || prev.char
  }

  return (
    <div className="rp-editor">
      <div className="rp-editor-head">
        <strong>
          <i className="fa-solid fa-masks-theater" /> 역극 대본
        </strong>
        <span>{blocks.length}개 블록</span>
        <button type="button" className="btn small ghost" onClick={() => setImporting(true)}>
          <i className="fa-solid fa-file-import" /> 텍스트로 한 번에 넣기
        </button>
      </div>

      {!speakers.length && <p className="field-help">페이지의 '역극 설정'에서 캐릭터를 먼저 등록하면 대사를 쓸 수 있어요.</p>}

      {blocks.map((b, i) => (
        <div key={b.id} className={`rp-block ${b.type}`}>
          {b.type === 'hr' ? (
            <div className="rp-block-hr">
              <span className="rp-block-label">
                <i className="fa-solid fa-grip-lines" /> 구분선
              </span>
              <input
                className="rp-hr-input"
                value={b.text}
                onChange={(e) => update(b.id, { text: e.target.value })}
                placeholder="선 가운데에 넣을 글 (선택) · 예: 장면 전환, 다음 날 아침"
                aria-label="구분선 글"
                maxLength={60}
                autoFocus={focusId === b.id}
              />
            </div>
          ) : b.type === 'say' ? (
            <div className="rp-block-say" style={map[b.char]?.color ? { '--cc': map[b.char].color } : undefined}>
              <div className="rp-speaker-pick" role="radiogroup" aria-label="말하는 사람">
                {speakers.map((c) => (
                  <button type="button" key={c.key} role="radio" aria-checked={b.char === c.key} className={b.char === c.key ? 'active' : ''} onClick={() => update(b.id, { char: c.key })} title={c.name}>
                    <Avatar char={c} size={30} />
                  </button>
                ))}
              </div>
              <div className="rp-block-main">
                <span className="rp-block-name">{map[b.char]?.name || b.name || '말하는 사람을 골라주세요'}</span>
                {formatting(b)}
                <AutoText className="rp-bubble-input" value={b.text} onChange={(t) => update(b.id, { text: t })} placeholder="대사" autoFocus={focusId === b.id} {...textProps(b)} />
                <InlinePreview text={b.text} />
              </div>
            </div>
          ) : (
            <div className="rp-block-act">
              <span className="rp-block-label">
                <i className="fa-solid fa-feather" /> 지문
              </span>
              {formatting(b)}
              <AutoText className="rp-act-input" value={b.text} onChange={(t) => update(b.id, { text: t })} placeholder="행동 묘사 · 서술 (빈 줄로 문단 나누기)" autoFocus={focusId === b.id} {...textProps(b)} />
              <InlinePreview text={b.text} />
            </div>
          )}
          <div className="rp-block-tools">
            {b.type === 'say' && onQuote && (
              <button
                type="button"
                className={quote?.text && quote.text === b.text.trim() ? 'active' : ''}
                onClick={() => onQuote({ char: b.char, text: b.text.trim() })}
                title="이 대사를 카드에 보이는 대표 대사로"
                aria-label="대표 대사로 정하기"
              >
                <i className="fa-solid fa-star" />
              </button>
            )}
            {b.type !== 'hr' && (
              <button type="button" onClick={() => update(b.id, b.type === 'say' ? { type: 'act' } : { type: 'say', char: b.char || nextSpeaker(i) })} title={b.type === 'say' ? '지문으로 바꾸기' : '대사로 바꾸기'} aria-label="대사/지문 바꾸기">
                <i className="fa-solid fa-right-left" />
              </button>
            )}
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="위로">
              <i className="fa-solid fa-arrow-up" />
            </button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} aria-label="아래로">
              <i className="fa-solid fa-arrow-down" />
            </button>
            <button type="button" onClick={() => insert(i + 1, { type: 'say', char: nextSpeaker(i + 1) })} title="아래에 대사 넣기" aria-label="아래에 대사 넣기">
              <i className="fa-regular fa-comment" />
            </button>
            <button type="button" onClick={() => insert(i + 1, { type: 'act' })} title="아래에 지문 넣기" aria-label="아래에 지문 넣기">
              <i className="fa-solid fa-feather" />
            </button>
            <button type="button" onClick={() => insert(i + 1, { type: 'hr' })} title="아래에 구분선 넣기" aria-label="아래에 구분선 넣기">
              <i className="fa-solid fa-grip-lines" />
            </button>
            <button type="button" className="danger" onClick={() => remove(b.id)} aria-label="블록 지우기">
              <i className="fa-solid fa-trash" />
            </button>
          </div>
        </div>
      ))}

      <div className="rp-add-row">
        {speakers.map((c) => (
          <button type="button" key={c.key} className="rp-add-btn" style={c.color ? { '--cc': c.color } : undefined} onClick={() => insert(blocks.length, { type: 'say', char: c.key })}>
            <Avatar char={c} size={24} /> {c.name} 대사
          </button>
        ))}
        <button type="button" className="rp-add-btn act" onClick={() => insert(blocks.length, { type: 'act' })}>
          <i className="fa-solid fa-feather" /> 지문
        </button>
        <button type="button" className="rp-add-btn act" onClick={() => insert(blocks.length, { type: 'hr' })}>
          <i className="fa-solid fa-grip-lines" /> 구분선
        </button>
      </div>

      {importing && (
        <ImportSheet
          chars={speakers.length ? speakers : chars}
          onClose={() => setImporting(false)}
          onImport={(list, replace) => {
            setBlocks((bs) => (replace ? list : [...bs, ...list]))
            setImporting(false)
          }}
        />
      )}
    </div>
  )
}

// '이름: 대사' 줄은 대사로, 나머지 줄은 지문으로 나눠 넣어요.
function ImportSheet({ chars, onClose, onImport }) {
  const [text, setText] = useState('')
  const list = useMemo(() => {
    const out = []
    const names = chars.map((c) => ({ c, names: [c.name, ...(c.alias || '').split(',')].map((s) => s.trim()).filter(Boolean) }))
    for (const raw of text.split('\n')) {
      const line = raw.trim()
      if (!line) {
        const last = out[out.length - 1]
        if (last?.type === 'act' && !last.text.endsWith('\n\n')) last.text += '\n\n'
        continue
      }
      if (/^([-*=_~─━·•]\s*){3,}$/.test(line)) {
        out.push({ id: uid('b'), type: 'hr', text: '' })
        continue
      }
      const m = line.match(/^([^:：「」"]{1,20})\s*[:：]\s*(.+)$/) || line.match(/^([^「」]{1,20})\s*「(.+)」$/)
      const hit = m && names.find((n) => n.names.includes(m[1].trim()))
      if (hit) out.push({ id: uid('b'), type: 'say', char: hit.c.key, text: m[2].trim() })
      else {
        const last = out[out.length - 1]
        if (last?.type === 'act') last.text += (last.text.endsWith('\n\n') ? '' : '\n') + line
        else out.push({ id: uid('b'), type: 'act', text: line })
      }
    }
    return out.map((b) => ({ ...b, text: b.text.trim() }))
  }, [text, chars])
  const says = list.filter((b) => b.type === 'say').length
  const hrs = list.filter((b) => b.type === 'hr').length
  return (
    <Sheet
      title="텍스트로 한 번에 넣기"
      onClose={onClose}
      wide
      footer={
        <div className="row gap-s" style={{ width: '100%' }}>
          <button type="button" className="btn" onClick={() => onImport(list, true)} disabled={!list.length} style={{ flex: 1 }}>
            바꿔 넣기
          </button>
          <button type="button" className="btn primary" onClick={() => onImport(list, false)} disabled={!list.length} style={{ flex: 2 }}>
            뒤에 이어 넣기
          </button>
        </div>
      }
    >
      <p className="sheet-help">
        <b>{chars.map((c) => c.name).join(', ')}</b> 이름으로 시작하는 줄(<code>이름: 대사</code> 또는 <code>이름「대사」</code>)은 대사로, 나머지는 지문으로 들어가요. 빈 줄은 지문의 문단을 나누고, <code>---</code>나 <code>* * *</code>만 있는 줄은 구분선이 돼요.
      </p>
      <textarea className="rp-import-text" rows={12} value={text} onChange={(e) => setText(e.target.value)} placeholder={`${chars[0]?.name || '미카즈키'}: 이런 곳에 사람이?\n달빛 아래 소녀는 고개를 들었다.\n${chars[1]?.name || '나나'}: …누구세요?`} />
      <p className="field-help">
        {list.length ? `대사 ${says}개 · 지문 ${list.length - says - hrs}개${hrs ? ` · 구분선 ${hrs}개` : ''}로 나뉘어요.` : '붙여넣으면 몇 개로 나뉘는지 알려줘요.'}
      </p>
    </Sheet>
  )
}
