import React, { useMemo, useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { Sheet } from './ui.jsx'
import { HR_KINDS, hrOptsOf, inlineHtml, parseScript } from './RpScript.jsx'

// 역극 로그를 다른 곳에 옮길 수 있게 바꿔줘요.
//  - 소설: 대사는 "큰따옴표" 안에, 지문은 문단으로, 구분선은 ***. 꾸밈은 빼고 글자만.
//  - 채팅 로그: AI 채팅 로그처럼 대사는 '이름: 대사', 서술 지문은 *지문*, 구분선은 ---. (제목은 기본으로 빼요)
//  - HTML: 지금 보이는 모습(두상·말풍선·지문·구분선·꾸밈) 그대로. 다른 사이트에는 이 사이트의 CSS가 없으니
//    모양을 전부 태그 안(style="…")에 적어요.

// 꾸밈 표시를 지운 글자만 (루비는 밑글자만 남겨요)
function plainOf(markup) {
  return String(markup || '')
    .replace(/[|｜]([^|｜《\n]+)《[^》\n]+》/g, '$1')
    .replace(/\[ruby=[^\]\n]*\]([\s\S]*?)\[\/ruby\]/g, '$1')
    .replace(/\[\/?(b|i|u|s|dot)\]|\[color=[^\]]*\]|\[\/color\]/g, '')
}

// {{나}} {{상대}} {{페어}} → 프로필 이름 (글자 그대로)
function namesOf(text, site) {
  if (site.features?.nameSwap === false) return text
  return text
    .replace(/\{\{\s*나\s*\}\}/g, site.pair.me.name || '')
    .replace(/\{\{\s*상대\s*\}\}/g, site.pair.partner.name || '')
    .replace(/\{\{\s*페어\s*\}\}/g, site.pair.pairName || '')
}

// 이미 따옴표로 감싼 대사는 한 번만 감싸요.
function quoted(text) {
  const t = text.trim()
  const m = t.match(/^["“「『](.*)["”」』]$/s)
  return `"${m ? m[1].trim() : t}"`
}

export function scriptToNovel(html, site, title) {
  const out = []
  if (title) out.push(title)
  for (const b of parseScript(html)) {
    if (b.type === 'hr') {
      out.push('***')
      const cap = plainOf(b.text).trim()
      if (cap) out.push(namesOf(cap, site))
    } else if (b.type === 'say') {
      const t = namesOf(plainOf(b.text), site).trim()
      if (t) out.push(quoted(t))
    } else {
      for (const p of String(b.text || '').split(/\n{2,}/)) {
        const t = namesOf(plainOf(p), site).trim()
        if (t) out.push(t)
      }
    }
  }
  return out.join('\n\n')
}

export function scriptToTranscript(html, chars, site, title) {
  const map = Object.fromEntries((chars || []).map((c) => [c.key, c]))
  const out = []
  if (title) out.push(title)
  for (const b of parseScript(html)) {
    if (b.type === 'hr') {
      out.push('---')
      const cap = plainOf(b.text).trim()
      if (cap) out.push(namesOf(cap, site))
    } else if (b.type === 'say') {
      const t = namesOf(plainOf(b.text), site).trim()
      const name = namesOf(map[b.char]?.name || b.name || '', site).trim()
      if (t) out.push(name ? `${name}: ${t}` : t)
    } else {
      // 서술 지문은 줄마다 *별표*로 감싸요. (이미 감싼 줄은 그대로)
      for (const p of String(b.text || '').split(/\n{2,}/)) {
        const lines = namesOf(plainOf(p), site)
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l) => (/^\*[^*][\s\S]*\*$/.test(l) ? l : `*${l.replace(/^\*+|\*+$/g, '')}*`))
        if (lines.length) out.push(lines.join('\n'))
      }
    }
  }
  return out.join('\n\n')
}

/* ---------------- HTML (모양 그대로) ---------------- */

function hex(c) {
  const s = String(c || '').trim()
  if (/^#[0-9a-f]{3}$/i.test(s)) return '#' + [...s.slice(1)].map((x) => x + x).join('')
  if (/^#[0-9a-f]{6}/i.test(s)) return s.slice(0, 7)
  const m = s.match(/rgba?\(([^)]+)\)/)
  if (m) return '#' + m[1].split(',').slice(0, 3).map((v) => Math.round(Number(v)).toString(16).padStart(2, '0')).join('')
  return null
}

// a를 b 위에 t만큼 섞은 색 (CSS color-mix를 못 쓰는 곳도 있어서 직접 계산해요)
function mix(a, b, t) {
  const x = hex(a)
  const y = hex(b)
  if (!x || !y) return a || b
  const n = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16)
  return '#' + [0, 1, 2].map((i) => Math.round(n(x, i) * t + n(y, i) * (1 - t)).toString(16).padStart(2, '0')).join('')
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

// 지금 화면에 칠해진 사이트 색
function currentColors() {
  const cs = getComputedStyle(document.documentElement)
  const v = (k, d) => hex(cs.getPropertyValue(k)) || d
  return { text: v('--text', '#111114'), sub: v('--text-sub', '#6d6d72'), surface: v('--surface', '#ffffff'), accent: v('--accent', '#3e91ff'), line: v('--line', '#e6e6ea') }
}

function absUrl(u) {
  if (!u) return ''
  return u.startsWith('/') ? window.location.origin + u : u
}

function inlineStyled(markup, site) {
  const h = inlineHtml(markup || '')
    .replace(/<em class="rp-dot">/g, '<em style="font-style:normal;-webkit-text-emphasis:filled dot;text-emphasis:filled dot;-webkit-text-emphasis-position:over right;text-emphasis-position:over right">')
    .replace(/<rt>/g, '<rt style="font-size:0.55em">')
    .replace(/\n/g, '<br>')
  // {{나}} 등은 이름으로 (이름도 HTML로 안전하게)
  return namesOf(h.replace(/\{\{\s*(나|상대|페어)\s*\}\}/g, (m) => `\u0000${m}\u0000`), site).replace(/\u0000([^\u0000]*)\u0000/g, (_, n) => esc(n))
}

export function scriptToHtmlCode(html, chars, site, title, colors = currentColors(), withBg = true) {
  const map = Object.fromEntries((chars || []).map((c) => [c.key, c]))
  const C = colors
  const rows = []
  for (const b of parseScript(html)) {
    if (b.type === 'say') {
      const ch = map[b.char] || { name: b.name, avatar: b.ava }
      const cc = hex(ch.color) || C.accent
      const right = ch.side === 'right'
      const ava = ch.avatar
        ? `<img src="${esc(absUrl(ch.avatar))}" alt="" style="width:46px;height:46px;border-radius:50%;object-fit:cover;flex:none;box-shadow:0 0 0 2px ${mix(cc, C.surface, 0.45)}">`
        : `<span style="width:46px;height:46px;border-radius:50%;flex:none;display:inline-flex;align-items:center;justify-content:center;background:${mix(cc, C.surface, 0.18)};color:${mix(cc, C.text, 0.7)};font-weight:700">${esc((ch.name || '?').slice(0, 1))}</span>`
      rows.push(
        `<div style="display:flex;gap:10px;align-items:flex-start;margin:14px 0;${right ? 'flex-direction:row-reverse;' : ''}">${ava}` +
          `<div style="display:flex;flex-direction:column;gap:4px;max-width:78%;${right ? 'align-items:flex-end;' : ''}">` +
          `<span style="font-size:0.8em;font-weight:700;color:${mix(cc, C.text, 0.6)}">${esc(ch.name || '')}</span>` +
          `<div style="padding:10px 14px;border-radius:${right ? '18px 6px 18px 18px' : '6px 18px 18px 18px'};background:${mix(cc, C.surface, 0.13)};border:1px solid ${mix(cc, C.surface, 0.22)};line-height:1.7;overflow-wrap:anywhere">${inlineStyled(b.text.trim(), site)}</div>` +
          `</div></div>`,
      )
    } else if (b.type === 'hr') {
      const o = hrOptsOf(b)
      const def = HR_KINDS.find((k) => k.value === o.kind)
      const col = o.color === 'accent' ? C.accent : hex(o.color) || null
      const lineCol = col || mix(C.text, C.surface, 0.22)
      const markCol = col || mix(C.text, C.surface, 0.45)
      const margin = { s: 14, m: 30, l: 56 }[o.gap]
      const maxW = { short: '36%', mid: '66%', full: '100%' }[o.width]
      const cap = b.text?.trim() ? inlineStyled(b.text.trim(), site) : ''
      if (o.kind === 'blank') rows.push(`<div style="height:1.4em;margin:${margin}px 0"></div>`)
      else if (def?.line) {
        const border = { fade: `1px solid ${lineCol}`, solid: `1px solid ${lineCol}`, dashed: `1px dashed ${lineCol}`, dotted: `2px dotted ${lineCol}`, double: `3px double ${lineCol}` }[o.kind]
        const line = `<span style="flex:1;border-top:${border}"></span>`
        rows.push(
          `<div style="display:flex;align-items:center;gap:14px;max-width:${maxW};margin:${margin}px auto;color:${col || C.sub};font-size:0.82em;font-weight:600">${line}${cap ? `<span style="flex:none;max-width:70%;text-align:center">${cap}</span>${line}` : ''}</div>`,
        )
      } else {
        const mark = o.kind === 'custom' ? o.mark || '◇' : def?.mark || '***'
        rows.push(
          `<div style="text-align:center;margin:${margin}px 0;color:${col || C.sub}"><div style="white-space:pre;color:${markCol};letter-spacing:0.1em">${esc(mark)}</div>${cap ? `<div style="margin-top:8px;font-size:0.78em;font-weight:600">${cap}</div>` : ''}</div>`,
        )
      }
    } else {
      const ps = String(b.text || '')
        .split(/\n{2,}/)
        .filter((p) => p.trim())
        .map((p) => `<p style="margin:0 0 0.9em;line-height:1.95;text-align:justify">${inlineStyled(p.trim(), site)}</p>`)
        .join('')
      if (ps) rows.push(`<div style="margin:18px 0;padding:0 6px">${ps}</div>`)
    }
  }
  const head = title ? `<h2 style="margin:0 0 18px;font-size:1.4em;line-height:1.4">${esc(namesOf(title, site))}</h2>` : ''
  const box = withBg ? `background:${C.surface};padding:24px;border-radius:16px;` : ''
  return `<div style="max-width:720px;margin:0 auto;${box}color:${C.text};line-height:1.8;font-size:15px;word-break:keep-all;overflow-wrap:anywhere">\n${head}${rows.join('\n')}\n</div>`
}

/* ---------------- 내보내기 창 ---------------- */

export function RpExportSheet({ kind, post, chars, onClose }) {
  const app = useApp()
  // 채팅 로그는 제목 없이 시작해요. (필요하면 체크해서 넣어요)
  const [withTitle, setWithTitle] = useState(kind !== 'script')
  const [withBg, setWithBg] = useState(true)
  const title = withTitle ? post.title : ''
  const text = useMemo(
    () =>
      kind === 'novel'
        ? scriptToNovel(post.content, app.site, title)
        : kind === 'script'
          ? scriptToTranscript(post.content, chars, app.site, title)
          : scriptToHtmlCode(post.content, chars, app.site, title, currentColors(), withBg),
    [kind, post.content, chars, app.site, title, withBg],
  )
  const NAMES = { novel: ['소설로 변환', '소설 글'], script: ['채팅 로그로 변환', '채팅 로그'], html: ['HTML 코드로 변환', 'HTML 코드'] }
  const [sheetTitle, label] = NAMES[kind] || NAMES.html
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      app.showToast(`${label}을(를) 복사했어요.`)
    } catch {
      // 클립보드를 못 쓰면 글칸을 선택해 둬서 Ctrl+C로 복사할 수 있게
      const ta = document.querySelector('.rp-export-text')
      ta?.select()
      app.showToast('Ctrl+C(⌘+C)를 눌러 복사해주세요.')
    }
  }
  return (
    <Sheet
      title={sheetTitle}
      onClose={onClose}
      wide
      footer={
        <div className="row gap-s" style={{ width: '100%' }}>
          <button type="button" className="btn" onClick={onClose} style={{ flex: 1 }}>
            닫기
          </button>
          <button type="button" className="btn primary" onClick={copy} style={{ flex: 2 }}>
            <i className="fa-regular fa-copy" /> 복사
          </button>
        </div>
      }
    >
      <p className="sheet-help">
        {kind === 'novel'
          ? '대사는 큰따옴표 안에, 지문은 문단으로, 구분선은 ***로 바꿨어요. 글자 꾸밈과 루비는 빼고 글자만 남겨요. 복사해서 메모장·블로그·소설 사이트에 붙여넣으면 돼요.'
          : kind === 'script'
            ? "AI 채팅 로그처럼 대사는 '이름: 대사'로, 서술 지문은 *별표* 안에, 구분선은 ---로 바꿨어요. 글자 꾸밈과 루비는 빼고 글자만 남겨요."
            : '지금 보이는 모습(두상·말풍선·지문·구분선·꾸밈) 그대로의 HTML이에요. 블로그·위키 등 HTML을 넣을 수 있는 곳에 붙여넣으면 돼요. 색은 지금 화면(라이트/다크)의 사이트 색을 따라요.'}
      </p>
      <div className="row gap-s wrap" style={{ marginBottom: 10 }}>
        <label className="check">
          <input type="checkbox" checked={withTitle} onChange={(e) => setWithTitle(e.target.checked)} />
          <span>맨 위에 제목 넣기</span>
        </label>
        {kind === 'html' && (
          <label className="check">
            <input type="checkbox" checked={withBg} onChange={(e) => setWithBg(e.target.checked)} />
            <span>카드 배경 넣기</span>
          </label>
        )}
      </div>
      {kind === 'html' && <div className="rp-export-preview" aria-label="미리보기" dangerouslySetInnerHTML={{ __html: text }} />}
      <textarea className={`rp-export-text ${kind === 'html' ? 'code' : ''}`} readOnly value={text} rows={kind === 'html' ? 8 : 14} onFocus={(e) => e.target.select()} aria-label={label} />
    </Sheet>
  )
}

