import React, { useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { formatDate, pad, parseDate, uid } from '../lib/format.js'
import { Sheet, Switch } from './ui.jsx'
import { ColorInput } from './Fields.jsx'

// 캘린더 일정은 사이트 설정(site.events)에 저장돼요.
// { id, date, endDate?, time?, label, note?, color?, annual? }

// 이 일정이 그 날짜(YYYY-MM-DD)에 걸쳐 있는지. 매년 반복은 그해 날짜로 옮겨서 비교해요.
export function eventOccurs(e, dateStr) {
  if (!e?.date || !/^\d{4}-\d{2}-\d{2}/.test(e.date)) return false
  let start = e.date.slice(0, 10)
  let end = e.endDate && e.endDate >= e.date ? e.endDate.slice(0, 10) : start
  if (e.annual) {
    const y = dateStr.slice(0, 4)
    const span = Math.round((parseDate(end) - parseDate(start)) / 86400000)
    start = `${y}${start.slice(4)}`
    const s = parseDate(start)
    const en = new Date(s.getFullYear(), s.getMonth(), s.getDate() + span)
    end = `${en.getFullYear()}-${pad(en.getMonth() + 1)}-${pad(en.getDate())}`
    // 연말에 시작해 해를 넘기는 매년 일정 (예: 12.30~1.2)
    if (dateStr < start) {
      const prevStart = `${Number(y) - 1}${e.date.slice(4, 10)}`
      const ps = parseDate(prevStart)
      const pe = new Date(ps.getFullYear(), ps.getMonth(), ps.getDate() + span)
      const prevEnd = `${pe.getFullYear()}-${pad(pe.getMonth() + 1)}-${pad(pe.getDate())}`
      return dateStr >= prevStart && dateStr <= prevEnd
    }
  }
  return dateStr >= start && dateStr <= end
}

export function eventWhen(e) {
  const md = (d) => `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`
  const multi = e.endDate && e.endDate > e.date
  let s
  if (e.annual) s = `매년 ${md(e.date)}${multi ? ` ~ ${md(e.endDate)}` : ''}`
  else if (multi && e.endDate.slice(0, 4) !== e.date.slice(0, 4)) s = `${e.date.slice(0, 4)}.${md(e.date)} ~ ${e.endDate.slice(0, 4)}.${md(e.endDate)}`
  else s = `${e.date.slice(0, 4)}.${md(e.date)}${multi ? ` ~ ${md(e.endDate)}` : ''}`
  if (e.time) s += ` · ${e.time}`
  return s
}

const EMPTY = { date: '', endDate: '', time: '', label: '', note: '', color: '', annual: false }

// 날짜를 누르면 뜨는 시트: 그날의 글과 일정을 보여주고, 관리자는 일정을 넣고 고칠 수 있어요.
export function DaySheet({ date, posts = [], events = [], onClose }) {
  const app = useApp()
  const [editing, setEditing] = useState(null) // 고치는 중인 일정 (새 일정이면 id 없음)
  const [busy, setBusy] = useState(false)

  async function saveEvents(next) {
    setBusy(true)
    try {
      await app.saveSetting('site', { ...app.site, events: next })
      return true
    } catch (e) {
      app.showToast(e.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function submit(ev) {
    if (!ev.label.trim() || !ev.date) return
    const clean = { ...ev, label: ev.label.trim(), note: (ev.note || '').trim(), time: (ev.time || '').trim() }
    if (!clean.endDate || clean.endDate <= clean.date) delete clean.endDate
    const list = app.site.events || []
    const next = clean.id ? list.map((x) => (x.id === clean.id ? clean : x)) : [...list, { ...clean, id: uid('ev') }]
    next.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    if (await saveEvents(next)) {
      app.showToast(clean.id ? '일정을 고쳤어요.' : '일정을 넣었어요.')
      setEditing(null)
    }
  }

  async function remove(ev) {
    if (!window.confirm(`'${ev.label}' 일정을 지울까요?`)) return
    if (await saveEvents((app.site.events || []).filter((x) => x.id !== ev.id))) {
      app.showToast('일정을 지웠어요.')
      setEditing(null)
    }
  }

  const title = formatDate(date, 'long') || date

  if (editing) {
    return (
      <EventForm
        initial={editing}
        busy={busy}
        onCancel={() => setEditing(null)}
        onSubmit={submit}
        onDelete={editing.id ? () => remove(editing) : null}
      />
    )
  }

  return (
    <Sheet
      title={title}
      onClose={onClose}
      footer={
        app.admin ? (
          <button type="button" className="btn primary block" onClick={() => setEditing({ ...EMPTY, date })}>
            <i className="fa-solid fa-plus" /> 이 날에 일정 넣기
          </button>
        ) : null
      }
    >
      {events.length === 0 && posts.length === 0 && <p className="sheet-help">이 날에는 일정도 기록도 없어요.</p>}
      {events.length > 0 && (
        <div className="day-section">
          <h3 className="day-section-title">일정</h3>
          <ul className="day-events">
            {events.map((e, i) => (
              <li key={e.id || i} className="day-event" style={e.color ? { '--ev-color': e.color } : undefined}>
                <span className="day-event-bar" />
                <div className="day-event-body">
                  <strong>{e.label}</strong>
                  <small>{eventWhen(e)}</small>
                  {e.note && <p>{e.note}</p>}
                </div>
                {app.admin && e.id && !e.fixed && (
                  <button type="button" className="icon-btn small" onClick={() => setEditing({ ...EMPTY, ...e })} aria-label={`${e.label} 고치기`}>
                    <i className="fa-solid fa-pen" />
                  </button>
                )}
                {app.admin && e.fixed && <small className="day-event-src">{e.fixed}</small>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {posts.length > 0 && (
        <div className="day-section">
          <h3 className="day-section-title">기록</h3>
          <ul className="day-posts">
            {posts.map((p) => (
              <li key={p.id}>
                <a href={`/post/${p.id}`} onClick={onClose}>
                  <i className={p.visibility === 'protected' ? 'fa-solid fa-lock' : 'fa-regular fa-file-lines'} />
                  <span>{p.title || '(제목 없음)'}</span>
                  <i className="fa-solid fa-chevron-right day-post-go" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Sheet>
  )
}

function EventForm({ initial, busy, onCancel, onSubmit, onDelete }) {
  const [ev, setEv] = useState(initial)
  const set = (patch) => setEv((x) => ({ ...x, ...patch }))
  return (
    <Sheet
      title={initial.id ? '일정 고치기' : '새 일정'}
      onClose={onCancel}
      footer={
        <div className="row gap-s" style={{ width: '100%' }}>
          {onDelete && (
            <button type="button" className="btn danger" onClick={onDelete} disabled={busy}>
              <i className="fa-solid fa-trash" />
            </button>
          )}
          <button type="button" className="btn" onClick={onCancel} style={{ flex: 1 }}>
            취소
          </button>
          <button type="button" className="btn primary" onClick={() => onSubmit(ev)} disabled={busy || !ev.label.trim() || !ev.date} style={{ flex: 2 }}>
            {busy ? '저장 중...' : '저장'}
          </button>
        </div>
      }
    >
      <div className="fields">
        <div className="field">
          <label className="field-label" htmlFor="ev-label">
            내용
          </label>
          <input id="ev-label" value={ev.label} onChange={(e) => set({ label: e.target.value })} placeholder="예: 생일, 콜라보 카페, 라이브" maxLength={60} autoFocus />
        </div>
        <div className="field ev-dates">
          <div>
            <label className="field-label" htmlFor="ev-date">
              날짜
            </label>
            <input id="ev-date" type="date" value={ev.date} onChange={(e) => set({ date: e.target.value })} />
          </div>
          <div>
            <label className="field-label" htmlFor="ev-end">
              끝나는 날 (선택)
            </label>
            <input id="ev-end" type="date" value={ev.endDate || ''} min={ev.date || undefined} onChange={(e) => set({ endDate: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="ev-time">
            시간 (선택)
          </label>
          <input id="ev-time" value={ev.time || ''} onChange={(e) => set({ time: e.target.value })} placeholder="예: 오후 7시, 19:00~21:00" maxLength={40} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="ev-note">
            메모 (선택)
          </label>
          <textarea id="ev-note" rows={3} value={ev.note || ''} onChange={(e) => set({ note: e.target.value })} placeholder="장소, 준비물, 링크 등" maxLength={500} />
        </div>
        <div className="field">
          <span className="field-label">표시 색</span>
          <ColorInput value={ev.color || ''} onChange={(v) => set({ color: v })} />
        </div>
        <div className="field">
          <Switch checked={!!ev.annual} onChange={(v) => set({ annual: v })} label="매년 반복" description="생일·기념일처럼 해마다 같은 날에 보여요." />
        </div>
      </div>
    </Sheet>
  )
}
