import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { uploadFile, pickFile } from '../lib/image.js'
import { escapeHtml, youtubeId } from '../lib/format.js'
import { FONTS } from '../lib/defaults.js'
import { loadFontByKey, loadFontsIn } from '../lib/theme.js'
import { api } from '../lib/api.js'
import { ImageEditor } from '../components/ImageEditor.jsx'
import { isEditableImage } from '../components/Fields.jsx'

const BLOCKS = [
  { value: 'p', label: '본문' },
  { value: 'h2', label: '제목 1' },
  { value: 'h3', label: '제목 2' },
  { value: 'h4', label: '제목 3' },
  { value: 'blockquote', label: '인용' },
  { value: 'pre', label: '코드' },
]

const SIZES = [
  { value: '2', label: '작게' },
  { value: '3', label: '보통' },
  { value: '4', label: '조금 크게' },
  { value: '5', label: '크게' },
  { value: '6', label: '아주 크게' },
  { value: '7', label: '제일 크게' },
]

const TEMPLATES = [
  {
    group: '대화',
    items: [
      {
        label: '메신저 대화',
        icon: 'fa-regular fa-comments',
        html: '<div class="chat"><div class="chat-row partner"><span class="chat-name">{{상대}}</span><div class="chat-bubble">메시지를 입력하세요</div></div><div class="chat-row me"><div class="chat-bubble">답장을 입력하세요</div></div></div><p><br></p>',
      },
      {
        label: '문자 메시지',
        icon: 'fa-regular fa-message',
        html: '<div class="chat sms"><div class="chat-time">오후 11:24</div><div class="chat-row partner"><div class="chat-bubble">자?</div></div><div class="chat-row me"><div class="chat-bubble">아니 아직</div></div></div><p><br></p>',
      },
      {
        label: '대사 (이름: 대사)',
        icon: 'fa-solid fa-quote-left',
        html: '<p class="line"><b class="line-name">{{상대}}</b> 대사를 입력하세요</p><p class="line"><b class="line-name">{{나}}</b> 대사를 입력하세요</p><p><br></p>',
      },
    ],
  },
  {
    group: '상자',
    items: [
      { label: '강조 상자', icon: 'fa-regular fa-square', html: '<div class="callout">강조하고 싶은 내용을 입력하세요</div><p><br></p>' },
      { label: '포인트 상자', icon: 'fa-solid fa-square', html: '<div class="callout accent">포인트 컬러 상자</div><p><br></p>' },
      { label: '메모지', icon: 'fa-regular fa-note-sticky', html: '<div class="memo-box">메모를 적어보세요</div><p><br></p>' },
      { label: '편지지', icon: 'fa-regular fa-envelope', html: '<div class="letter"><p>To. {{상대}}</p><p>편지 내용을 적어보세요.</p><p class="letter-from">From. {{나}}</p></div><p><br></p>' },
      { label: '접은 글', icon: 'fa-solid fa-caret-down', html: '<details class="fold"><summary>더보기</summary><p>접어둘 내용을 입력하세요</p></details><p><br></p>' },
      { label: '경고문 (트리거 주의)', icon: 'fa-solid fa-triangle-exclamation', html: '<div class="callout warn">⚠ 주의: 내용을 입력하세요</div><p><br></p>' },
    ],
  },
  {
    group: '구분선',
    items: [
      { label: '선', icon: 'fa-solid fa-minus', html: '<hr><p><br></p>' },
      { label: '점선', icon: 'fa-solid fa-ellipsis', html: '<hr class="dots"><p><br></p>' },
      { label: '하트', icon: 'fa-solid fa-heart', html: '<hr class="heart"><p><br></p>' },
      { label: '별', icon: 'fa-solid fa-star', html: '<hr class="star"><p><br></p>' },
      { label: '여백', icon: 'fa-solid fa-arrows-up-down', html: '<div class="spacer"></div><p><br></p>' },
    ],
  },
  {
    group: '기타',
    items: [
      {
        label: '표 (3×3)',
        icon: 'fa-solid fa-table',
        html: '<table><tbody><tr><th>제목</th><th>제목</th><th>제목</th></tr><tr><td>내용</td><td>내용</td><td>내용</td></tr><tr><td>내용</td><td>내용</td><td>내용</td></tr></tbody></table><p><br></p>',
      },
      { label: '프로필 카드', icon: 'fa-regular fa-id-card', html: '<div class="profile-card"><img src="" alt=""><div><strong>이름</strong><p>설명을 적어보세요</p></div></div><p><br></p>' },
    ],
  },
]

export function RichEditor({ value, onChange, mode, onModeChange }) {
  const app = useApp()
  const editorRef = useRef(null)
  const lastHtml = useRef(null)
  const savedRange = useRef(null)
  const [menu, setMenu] = useState(null)
  const [uploading, setUploading] = useState(0)
  const [imgEdit, setImgEdit] = useState(null) // { src, file, name, target }
  const selectedImg = useRef(null)
  const [imgSel, setImgSel] = useState(null) // 지금 골라진 사진 (사진 도구 막대를 띄우려고)
  const [state, setState] = useState({})

  // 바깥에서 값이 바뀌었을 때만 편집 영역을 다시 그립니다. (커서가 튀지 않게)
  useEffect(() => {
    const el = editorRef.current
    if (mode !== 'rich' || !el) return
    if (value !== lastHtml.current) {
      el.innerHTML = value || ''
      lastHtml.current = value
      loadFontsIn(el)
    }
  }, [value, mode])

  useEffect(() => {
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p')
    } catch {
      // 지원하지 않는 브라우저
    }
    const onSel = () => {
      const sel = window.getSelection()
      if (!sel.rangeCount || !editorRef.current) return
      const range = sel.getRangeAt(0)
      if (editorRef.current.contains(range.commonAncestorContainer)) {
        savedRange.current = range.cloneRange()
        setState({
          bold: document.queryCommandState('bold'),
          italic: document.queryCommandState('italic'),
          underline: document.queryCommandState('underline'),
          strikeThrough: document.queryCommandState('strikeThrough'),
          ul: document.queryCommandState('insertUnorderedList'),
          ol: document.queryCommandState('insertOrderedList'),
          block: String(document.queryCommandValue('formatBlock') || 'p').toLowerCase(),
          align: document.queryCommandState('justifyCenter') ? 'center' : document.queryCommandState('justifyRight') ? 'right' : document.queryCommandState('justifyFull') ? 'full' : 'left',
        })
      }
    }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [])

  function emit() {
    // 사진 선택 표시(img-selected)는 저장하지 않아요.
    const html = editorRef.current.innerHTML.replace(/ class="img-selected"/g, '').replace(/\s?img-selected/g, '')
    lastHtml.current = html
    onChange(html)
  }

  function restore() {
    const el = editorRef.current
    el.focus()
    if (savedRange.current) {
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(savedRange.current)
    }
  }

  function exec(cmd, arg = null) {
    restore()
    document.execCommand('styleWithCSS', false, ['foreColor', 'hiliteColor', 'backColor'].includes(cmd))
    document.execCommand(cmd, false, arg)
    emit()
  }

  function insertHtml(html) {
    restore()
    document.execCommand('insertHTML', false, html)
    emit()
    setMenu(null)
  }

  // 블록(대화·상자·사진 등)은 execCommand 대신 직접 끼워 넣어요. (크롬이 구조를 망가뜨리는 걸 막기 위해)
  function insertBlock(html) {
    const el = editorRef.current
    el.focus()
    const tpl = document.createElement('template')
    tpl.innerHTML = html
    const nodes = Array.from(tpl.content.childNodes)
    let anchor = savedRange.current?.startContainer
    while (anchor && anchor.parentNode !== el) anchor = anchor.parentNode
    if (anchor && anchor.nodeType === 3) {
      // 문단으로 감싸지지 않은 맨 윗줄 글자는 <p>로 감싸줍니다.
      const p = document.createElement('p')
      anchor.replaceWith(p)
      p.appendChild(anchor)
      anchor = p
    }
    const emptyAnchor = anchor && anchor.textContent.trim() === '' && !anchor.querySelector?.('img,iframe')
    if (anchor) anchor.after(...nodes)
    else el.append(...nodes)
    if (emptyAnchor) anchor.remove()
    const last = nodes[nodes.length - 1]
    if (last) {
      const range = document.createRange()
      range.selectNodeContents(last)
      range.collapse(false)
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
      savedRange.current = range.cloneRange()
    }
    emit()
    setMenu(null)
  }

  function wrapSelection(className, tag = 'span') {
    restore()
    const sel = window.getSelection()
    const text = sel.toString()
    if (!text) {
      app.showToast('먼저 글자를 선택해주세요.')
      return
    }
    insertHtml(`<${tag} class="${className}">${escapeHtml(text)}</${tag}>`)
  }

  // 본문 속 사진을 누르면 골라진 상태가 되고, "사진 편집"으로 바로 고칠 수 있어요.
  function onEditorClick(e) {
    selectedImg.current?.classList.remove('img-selected')
    selectedImg.current = null
    if (e.target.tagName === 'IMG' && editorRef.current.contains(e.target)) {
      selectedImg.current = e.target
      e.target.classList.add('img-selected')
      setImgSel({ el: e.target, spoiler: e.target.classList.contains('spoiler-img') })
    } else {
      setImgSel(null)
    }
  }

  function clearImgSel() {
    selectedImg.current?.classList.remove('img-selected')
    selectedImg.current = null
    setImgSel(null)
  }

  // 골라진 사진을 스포일러(흐리게 가리고 누르면 보이기)로 바꾸거나 되돌려요.
  function toggleImgSpoiler() {
    const el = selectedImg.current
    if (!el || !editorRef.current?.contains(el)) return clearImgSel()
    const on = !el.classList.contains('spoiler-img')
    el.classList.toggle('spoiler-img', on)
    setImgSel({ el, spoiler: on })
    emit()
  }

  function removeSelectedImg() {
    const el = selectedImg.current
    if (!el || !editorRef.current?.contains(el)) return clearImgSel()
    el.remove()
    clearImgSel()
    emit()
  }

  async function openImageEditor() {
    const target = selectedImg.current
    if (target && editorRef.current?.contains(target)) {
      setImgEdit({ src: target.src, name: target.src.split('/').pop(), target })
      return
    }
    const [file] = await pickFile('image/*')
    if (!file) return
    if (!isEditableImage(file.type + file.name)) {
      insertImages([file])
      return
    }
    setImgEdit({ src: URL.createObjectURL(file), file, name: file.name })
  }

  async function applyImageEdit(file, { edited }) {
    const job = imgEdit
    setUploading((n) => n + 1)
    try {
      const url = edited ? (await api.upload(file)).url : await uploadFile(file)
      if (job.target && editorRef.current?.contains(job.target)) {
        job.target.src = url
        job.target.classList.remove('img-selected')
        emit()
      } else {
        insertBlock(`<p><img src="${url}" alt=""></p><p><br></p>`)
      }
      if (job.src.startsWith('blob:')) URL.revokeObjectURL(job.src)
      setImgEdit(null)
    } catch (e) {
      app.showToast(e.message)
    } finally {
      setUploading((n) => Math.max(0, n - 1))
    }
  }

  async function insertImages(files, asRow = false) {
    const images = files.filter((f) => f.type.startsWith('image/'))
    if (!images.length) return
    setUploading((n) => n + images.length)
    try {
      const urls = []
      for (const f of images) {
        urls.push(await uploadFile(f))
        setUploading((n) => n - 1)
      }
      const tags = urls.map((u) => `<img src="${u}" alt="">`).join('')
      insertBlock(asRow && urls.length > 1 ? `<div class="img-row">${tags}</div><p><br></p>` : `<p>${tags}</p><p><br></p>`)
    } catch (e) {
      app.showToast(e.message)
      setUploading(0)
    }
  }

  function onPaste(e) {
    const files = Array.from(e.clipboardData?.files || [])
    if (files.some((f) => f.type.startsWith('image/'))) {
      e.preventDefault()
      insertImages(files)
    }
  }

  function onDrop(e) {
    const files = Array.from(e.dataTransfer?.files || [])
    if (files.length) {
      e.preventDefault()
      const range = document.caretRangeFromPoint?.(e.clientX, e.clientY)
      if (range) savedRange.current = range
      insertImages(files, files.length > 1)
    }
  }

  function addLink() {
    const url = window.prompt('연결할 주소를 입력하세요', 'https://')
    if (!url) return
    const sel = savedRange.current?.toString()
    if (sel) exec('createLink', url)
    else insertHtml(`<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`)
  }

  function addYoutube() {
    const url = window.prompt('유튜브 주소를 붙여넣어 주세요')
    const id = youtubeId(url)
    if (!id) {
      if (url) app.showToast('유튜브 주소를 알아보지 못했어요.')
      return
    }
    insertBlock(
      `<div class="video-wrap"><iframe src="https://www.youtube.com/embed/${id}" title="YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div><p><br></p>`,
    )
  }

  const Btn = ({ icon, label, onClick, active, children }) => (
    <button
      type="button"
      className={`tb-btn ${active ? 'active' : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : !!active}
    >
      {icon ? <i className={icon} /> : children}
    </button>
  )

  const toggleMenu = (name) => setMenu((m) => (m === name ? null : name))
  // 메뉴 안 버튼: 글자 선택이 풀리지 않게 mousedown을 막아요.
  const MI = ({ icon, label, onClick, active, keep, children }) => (
    <button
      type="button"
      className={active ? 'active' : ''}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        onClick()
        if (!keep) setMenu(null)
      }}
    >
      {icon && <i className={icon} />} {children || label}
    </button>
  )
  const MenuBtn = ({ name, icon, label, current }) => (
    <button
      type="button"
      className={`tb-btn tb-menu-btn ${menu === name ? 'active' : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => toggleMenu(name)}
      aria-expanded={menu === name}
      title={label}
    >
      <i className={current || icon} />
      <span className="tb-text">{label}</span>
      <i className="fa-solid fa-chevron-down tb-caret" />
    </button>
  )
  const alignIcon = { left: 'fa-solid fa-align-left', center: 'fa-solid fa-align-center', right: 'fa-solid fa-align-right', full: 'fa-solid fa-align-justify' }[state.align || 'left']

  const modeToggle = (
    <button
      type="button"
      className={`tb-btn tb-mode-btn ${mode === 'html' ? 'active' : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        lastHtml.current = null
        setMenu(null)
        onModeChange(mode === 'html' ? 'rich' : 'html')
      }}
      title={mode === 'html' ? '에디터로 돌아가기' : 'HTML로 직접 고치기'}
      aria-pressed={mode === 'html'}
    >
      <i className="fa-solid fa-code" />
      <span className="tb-text">{mode === 'html' ? '에디터로' : 'HTML'}</span>
    </button>
  )

  return (
    <div className={`rich-editor mode-${mode}`}>
      <div className="toolbar" role="toolbar" aria-label="글 서식">
        {mode === 'rich' ? (
          <div className="tb-groups">
            <div className="tb-group">
              <select className="tb-select" value={BLOCKS.some((b) => b.value === state.block) ? state.block : 'p'} onChange={(e) => exec('formatBlock', e.target.value)} aria-label="문단 모양">
                {BLOCKS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="tb-group">
              <Btn icon="fa-solid fa-bold" label="굵게 (Ctrl+B)" active={state.bold} onClick={() => exec('bold')} />
              <Btn icon="fa-solid fa-italic" label="기울임 (Ctrl+I)" active={state.italic} onClick={() => exec('italic')} />
              <Btn icon="fa-solid fa-underline" label="밑줄 (Ctrl+U)" active={state.underline} onClick={() => exec('underline')} />
              <MenuBtn name="text" icon="fa-solid fa-font" label="글자" />
            </div>
            <div className="tb-group">
              <MenuBtn name="align" icon="fa-solid fa-align-left" current={alignIcon} label="정렬" />
              <MenuBtn name="list" icon="fa-solid fa-list-ul" label="목록" />
            </div>
            <div className="tb-group">
              <Btn icon="fa-solid fa-link" label="링크" onClick={addLink} />
              <MenuBtn name="photo" icon="fa-regular fa-image" label="사진" />
              <MenuBtn name="insert" icon="fa-solid fa-plus" label="넣기" />
            </div>
            <div className="tb-group">{modeToggle}</div>
          </div>
        ) : (
          <div className="tb-groups">
            <span className="tb-html-hint">HTML 직접 입력 중 · &lt;style&gt;, &lt;script&gt;도 쓸 수 있어요</span>
            <div className="tb-group">{modeToggle}</div>
          </div>
        )}
      </div>

      {mode === 'rich' && menu && (
        <div className="tb-menu">
          {menu === 'text' && (
            <>
              <div className="tb-menu-group">
                <span className="tb-menu-label">모양</span>
                <div className="tb-menu-items">
                  <MI icon="fa-solid fa-strikethrough" label="취소선" active={state.strikeThrough} onClick={() => exec('strikeThrough')} />
                  <MI icon="fa-solid fa-eye-slash" label="스포일러" onClick={() => wrapSelection('spoiler')} />
                  <MI icon="fa-solid fa-text-slash" label="서식 지우기" onClick={() => exec('removeFormat')} />
                  <label className="tb-color-chip" onMouseDown={() => restore()}>
                    <i className="fa-solid fa-palette" /> 글자색
                    <input type="color" onChange={(e) => exec('foreColor', e.target.value)} aria-label="글자색" />
                  </label>
                  <label className="tb-color-chip" onMouseDown={() => restore()}>
                    <i className="fa-solid fa-highlighter" /> 형광펜
                    <input type="color" defaultValue="#fff59d" onChange={(e) => exec('hiliteColor', e.target.value)} aria-label="형광펜 색" />
                  </label>
                </div>
              </div>
              <div className="tb-menu-group">
                <span className="tb-menu-label">크기</span>
                <div className="tb-menu-items">
                  {SIZES.map((sz) => (
                    <MI key={sz.value} label={sz.label} keep onClick={() => exec('fontSize', sz.value)} />
                  ))}
                </div>
              </div>
              <div className="tb-menu-group">
                <span className="tb-menu-label">글꼴</span>
                <select
                  className="tb-font-select"
                  value=""
                  onChange={(e) => {
                    const font = FONTS.find((f) => f.key === e.target.value)
                    if (!font) return
                    loadFontByKey(font.key)
                    exec('fontName', font.family.split(',')[0].replace(/['"]/g, '').trim())
                    setMenu(null)
                  }}
                  aria-label="글꼴"
                >
                  <option value="">글꼴 고르기</option>
                  {FONTS.filter((f) => f.key !== 'custom' && f.key !== 'system').map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {menu === 'align' && (
            <div className="tb-menu-items">
              <MI icon="fa-solid fa-align-left" label="왼쪽" active={state.align === 'left'} onClick={() => exec('justifyLeft')} />
              <MI icon="fa-solid fa-align-center" label="가운데" active={state.align === 'center'} onClick={() => exec('justifyCenter')} />
              <MI icon="fa-solid fa-align-right" label="오른쪽" active={state.align === 'right'} onClick={() => exec('justifyRight')} />
              <MI icon="fa-solid fa-align-justify" label="양쪽" active={state.align === 'full'} onClick={() => exec('justifyFull')} />
            </div>
          )}

          {menu === 'list' && (
            <div className="tb-menu-items">
              <MI icon="fa-solid fa-list-ul" label="글머리 목록" active={state.ul} onClick={() => exec('insertUnorderedList')} />
              <MI icon="fa-solid fa-list-ol" label="번호 목록" active={state.ol} onClick={() => exec('insertOrderedList')} />
              <MI icon="fa-solid fa-indent" label="들여쓰기" keep onClick={() => exec('indent')} />
              <MI icon="fa-solid fa-outdent" label="내어쓰기" keep onClick={() => exec('outdent')} />
            </div>
          )}

          {menu === 'photo' && (
            <>
              <p className="tb-menu-help">본문 사진을 한 번 누르면 사진 도구가 떠요. 거기서 편집하거나 스포일러로 가릴 수 있어요. 사진은 붙여넣기·끌어놓기로도 넣을 수 있어요.</p>
              <div className="tb-menu-items">
                <MI icon="fa-solid fa-crop-simple" label="편집해서 올리기 / 사진 편집" onClick={openImageEditor} />
                <MI icon="fa-regular fa-image" label="바로 올리기" onClick={async () => insertImages(await pickFile('image/*', true))} />
                <MI icon="fa-solid fa-images" label="여러 장 나란히" onClick={async () => insertImages(await pickFile('image/*', true), true)} />
              </div>
            </>
          )}

          {menu === 'insert' && (
            <>
              <div className="tb-menu-group">
                <span className="tb-menu-label">이름 변환 · 글을 볼 때 프로필 이름으로 바뀌어요</span>
                <div className="tb-menu-items">
                  {[
                    ['{{나}}', app.site.pair.me.name],
                    ['{{상대}}', app.site.pair.partner.name],
                    ['{{페어}}', app.site.pair.pairName],
                  ].map(([code, name]) => (
                    <MI key={code} onClick={() => insertHtml(code)}>
                      <code>{code}</code> → {name}
                    </MI>
                  ))}
                </div>
              </div>
              {TEMPLATES.map((g) => (
                <div key={g.group} className="tb-menu-group">
                  <span className="tb-menu-label">{g.group}</span>
                  <div className="tb-menu-items">
                    {g.items.map((t) => (
                      <MI key={t.label} icon={t.icon} label={t.label} onClick={() => insertBlock(t.html)} />
                    ))}
                    {g.group === '기타' && <MI icon="fa-brands fa-youtube" label="유튜브" onClick={addYoutube} />}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {mode === 'rich' && imgSel && (
        <div className="img-tool-bar" role="toolbar" aria-label="선택한 사진">
          <span className="img-tool-label">
            <i className="fa-regular fa-image" /> 선택한 사진
          </span>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={openImageEditor}>
            <i className="fa-solid fa-crop-simple" /> 편집
          </button>
          <button type="button" className={imgSel.spoiler ? 'active' : ''} aria-pressed={imgSel.spoiler} onMouseDown={(e) => e.preventDefault()} onClick={toggleImgSpoiler}>
            <i className={imgSel.spoiler ? 'fa-solid fa-eye-slash' : 'fa-regular fa-eye-slash'} /> {imgSel.spoiler ? '스포일러 해제' : '스포일러로 가리기'}
          </button>
          <button type="button" className="danger" onMouseDown={(e) => e.preventDefault()} onClick={removeSelectedImg}>
            <i className="fa-solid fa-trash" /> 삭제
          </button>
          <button type="button" className="img-tool-close" onClick={clearImgSel} aria-label="선택 해제">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      )}

      {mode === 'rich' ? (
        <div
          ref={editorRef}
          className="editor-area prose"
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          onPaste={onPaste}
          onClick={onEditorClick}
          onDrop={onDrop}
          role="textbox"
          aria-multiline="true"
          aria-label="본문"
          data-placeholder="내용을 입력하세요"
        />
      ) : (
        <textarea
          className="html-area code"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          aria-label="HTML 본문"
          placeholder="<p>HTML을 직접 입력하세요. <style>이나 <script>도 쓸 수 있어요.</p>"
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              e.preventDefault()
              const t = e.target
              const s = t.selectionStart
              const next = t.value.slice(0, s) + '  ' + t.value.slice(t.selectionEnd)
              onChange(next)
              requestAnimationFrame(() => t.setSelectionRange(s + 2, s + 2))
            }
          }}
        />
      )}
      {imgEdit && (
        <ImageEditor
          src={imgEdit.src}
          fileName={imgEdit.name}
          guide="post"
          originalFile={imgEdit.file}
          onCancel={() => {
            if (imgEdit.src.startsWith('blob:')) URL.revokeObjectURL(imgEdit.src)
            setImgEdit(null)
          }}
          onApply={applyImageEdit}
        />
      )}
      {uploading > 0 && (
        <div className="upload-status">
          <i className="fa-solid fa-spinner fa-spin" /> 사진 {uploading}장 올리는 중...
        </div>
      )}
    </div>
  )
}
