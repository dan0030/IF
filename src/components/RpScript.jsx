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

export function scriptToHtml(blocks, chars) {
  const map = Object.fromEntries((chars || []).map((c) => [c.key, c]))
  const body = blocks
    .filter((b) => b.type === 'hr' || (b.text || '').trim())
    .map((b) => {
      if (b.type === 'hr') {
        const label = (b.text || '').trim()
        return `<div class="rp-hr">${label ? `<span>${esc(label)}</span>` : ''}</div>`
      }
      if (b.type === 'say') {
        const c = map[b.char] || {}
        const name = c.name || b.name || ''
        return `<div class="rp-say" data-char="${esc(b.char)}"${c.avatar ? ` data-ava="${esc(c.avatar)}"` : ''}><b class="rp-who">${esc(name)}</b><div class="rp-text">${esc(b.text.trim()).replace(/\n/g, '<br>')}</div></div>`
      }
      const paras = b.text
        .trim()
        .split(/\n{2,}/)
        .map((p) => `<p>${esc(p.trim()).replace(/\n/g, '<br>')}</p>`)
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
        return { id: uid('b'), type: 'say', char: el.dataset.char || '', name: textOf(el.querySelector('.rp-who')), ava: el.dataset.ava || '', text: textOf(el.querySelector('.rp-text')) }
      }
      if (el.classList.contains('rp-hr')) {
        return { id: uid('b'), type: 'hr', text: textOf(el.querySelector('span')) }
      }
      if (el.classList.contains('rp-act')) {
        const ps = [...el.querySelectorAll('p')]
        return { id: uid('b'), type: 'act', text: ps.length ? ps.map(textOf).join('\n\n') : textOf(el) }
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
        <div className="rp-bubble">{swapNames(text, site)}</div>
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
          <Divider key={b.id} text={swapNames(b.text || '', site)} />
        ) : b.type === 'say' ? (
          <SayLine key={b.id} char={map[b.char] || { name: b.name, avatar: b.ava }} text={b.text} />
        ) : (
          <div key={b.id} className="rp-act-view">
            {b.text.split(/\n{2,}/).map((p, i) => (
              <p key={i}>{swapNames(p, site)}</p>
            ))}
          </div>
        ),
      )}
    </div>
  )
}

// 장면을 나누는 구분선. 글을 적으면 선 가운데에 보여요.
function Divider({ text }) {
  return (
    <div className={`rp-hr ${text ? 'has-text' : ''}`} role="separator">
      {text ? <span>{text}</span> : null}
    </div>
  )
}

/* ---------------- 편집 ---------------- */

function AutoText({ value, onChange, placeholder, className, autoFocus }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [value])
  return <textarea ref={ref} rows={1} className={className} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} />
}

export function RpScriptEditor({ value, onChange, chars, cast, quote, onQuote }) {
  const [blocks, setBlocks] = useState(() => {
    const parsed = parseScript(value)
    return parsed.length ? parsed : []
  })
  const [focusId, setFocusId] = useState(null)
  const [importing, setImporting] = useState(false)
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
                <AutoText className="rp-bubble-input" value={b.text} onChange={(t) => update(b.id, { text: t })} placeholder="대사" autoFocus={focusId === b.id} />
              </div>
            </div>
          ) : (
            <div className="rp-block-act">
              <span className="rp-block-label">
                <i className="fa-solid fa-feather" /> 지문
              </span>
              <AutoText className="rp-act-input" value={b.text} onChange={(t) => update(b.id, { text: t })} placeholder="행동 묘사 · 서술 (빈 줄로 문단 나누기)" autoFocus={focusId === b.id} />
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
