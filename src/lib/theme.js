import { FONTS } from './defaults.js'

const loadedFonts = new Set()

function loadGoogleFont(font) {
  if (!font?.google || loadedFonts.has(font.key)) return
  loadedFonts.add(font.key)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`
  document.head.appendChild(link)
}

// 글 본문에서 <font face> 등으로 쓴 글꼴을 찾아 불러옵니다.
export function loadFontsIn(root) {
  const names = new Set()
  root.querySelectorAll('font[face], [style*="font-family"]').forEach((el) => {
    const raw = el.getAttribute('face') || el.style.fontFamily || ''
    raw.split(',').forEach((n) => names.add(n.trim().replace(/^['"]|['"]$/g, '')))
  })
  for (const font of FONTS) {
    const name = font.family.split(',')[0].trim().replace(/^['"]|['"]$/g, '')
    if (names.has(name)) loadGoogleFont(font)
  }
}

export function loadFontByKey(key) {
  loadGoogleFont(FONTS.find((f) => f.key === key))
}

function fontFamily(key, theme) {
  const font = FONTS.find((f) => f.key === key) || FONTS[0]
  loadGoogleFont(font)
  if (key === 'custom' && !theme.customFontUrl) return FONTS[0].family
  return font.family
}

function styleTag(id) {
  let el = document.getElementById(id)
  if (!el) {
    el = document.createElement('style')
    el.id = id
    document.head.appendChild(el)
  }
  return el
}

const PATTERNS = {
  dots: (c, s) => `radial-gradient(${c} 1.4px, transparent 1.6px) 0 0 / ${s}px ${s}px`,
  grid: (c, s) => `linear-gradient(${c} 1px, transparent 1px) 0 0 / ${s}px ${s}px, linear-gradient(90deg, ${c} 1px, transparent 1px) 0 0 / ${s}px ${s}px`,
  lines: (c, s) => `linear-gradient(transparent ${s - 1}px, ${c} ${s - 1}px) 0 0 / 100% ${s}px`,
  diagonal: (c, s) => `repeating-linear-gradient(45deg, ${c} 0 1px, transparent 1px ${Math.round(s / 2)}px)`,
  checker: (c, s) => `conic-gradient(${c} 25%, transparent 0 50%, ${c} 0 75%, transparent 0) 0 0 / ${s * 2}px ${s * 2}px`,
  hearts: (c, s) => svgPattern(`<path d="M12 21s-7-4.6-9.3-9C1 8.3 3.4 5 6.6 5c2 0 3.3 1.1 4.1 2.3h.6C12.1 6.1 13.4 5 15.4 5c3.2 0 5.6 3.3 3.9 7-2.3 4.4-9.3 9-9.3 9Z" transform="scale(.5) translate(12 12)" fill="${c}"/>`, s),
  stars: (c, s) => svgPattern(`<path d="M12 4l1.9 5.2H19l-4.2 3.2 1.6 5.2L12 14.4l-4.4 3.2 1.6-5.2L5 9.2h5.1Z" transform="scale(.5) translate(12 12)" fill="${c}"/>`, s),
}

function svgPattern(inner, size) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${inner}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 0 0 / ${size * 1.4}px ${size * 1.4}px`
}

// 기본으로 고를 수 있는 커서 모양 (포인트 색으로 칠해져요)
const CURSOR_SHAPES = {
  heart: 'M12 21s-7-4.6-9.3-9C1 8.3 3.4 5 6.6 5c2 0 3.3 1.1 4.1 2.3h.6C12.1 6.1 13.4 5 15.4 5c3.2 0 5.6 3.3 3.9 7-2.3 4.4-9.3 9-9.3 9Z',
  star: 'M12 2.5l2.8 6.2 6.7.6-5.1 4.5 1.5 6.6L12 17l-5.9 3.4 1.5-6.6L2.5 9.3l6.7-.6Z',
  paw: 'M7 8.5a2 2.6 0 1 1 0-.1Zm10 0a2 2.6 0 1 1 0-.1ZM3.6 13a1.8 2.3 0 1 1 0-.1Zm16.8 0a1.8 2.3 0 1 1 0-.1ZM12 12c3 0 6 3.6 6 6.2 0 2-1.7 2.8-3.2 2.8-1.2 0-1.9-.6-2.8-.6s-1.6.6-2.8.6C7.7 21 6 20.2 6 18.2 6 15.6 9 12 12 12Z',
  sparkle: 'M12 1.5c.8 5.5 2.9 8 9.5 10.5-6.6 2.5-8.7 5-9.5 10.5-.8-5.5-2.9-8-9.5-10.5C9.1 9.5 11.2 7 12 1.5Z',
}

function shapeCursor(shape, color, size) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><path d="${CURSOR_SHAPES[shape]}" fill="${color}" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function cursorCss(theme, pal) {
  const q = (u) => `url("${String(u).replace(/"/g, '%22')}")`
  const clickable = 'a, button, label, select, summary, [role="button"], [role="tab"], [role="radio"], input[type="checkbox"], input[type="range"], input[type="color"]'
  if (CURSOR_SHAPES[theme.cursor]) {
    const size = Math.max(16, Math.min(64, Number(theme.cursorSize) || 28))
    const accent = /^#|^rgb/.test(pal.accent) ? pal.accent : '#3e91ff'
    const normal = shapeCursor(theme.cursor, accent, size)
    const hover = shapeCursor(theme.cursor, accent, Math.round(size * 1.25))
    return `html, body { cursor: ${q(normal)} ${Math.round(size / 2)} ${Math.round(size / 2)}, auto; }
      ${clickable} { cursor: ${q(hover)} ${Math.round(size * 0.62)} ${Math.round(size * 0.62)}, pointer; }`
  }
  if (theme.cursor === 'custom' && (theme.cursorImage || theme.cursorPointerImage)) {
    let css = ''
    if (theme.cursorImage) css += `html, body { cursor: ${q(theme.cursorImage)} ${Number(theme.cursorX) || 0} ${Number(theme.cursorY) || 0}, auto; }`
    const pointer = theme.cursorPointerImage || theme.cursorImage
    const px = theme.cursorPointerImage ? theme.cursorPointerX : theme.cursorX
    const py = theme.cursorPointerImage ? theme.cursorPointerY : theme.cursorY
    css += `\n${clickable} { cursor: ${q(pointer)} ${Number(px) || 0} ${Number(py) || 0}, pointer; }`
    return css
  }
  return ''
}

function pageBackground(theme, pal, mode) {
  switch (theme.bgType) {
    case 'gradient':
      return `linear-gradient(${theme.bgAngle}deg, ${pal.bg} 0%, ${pal.bg2} 100%)`
    case 'pattern': {
      const make = PATTERNS[theme.pattern] || PATTERNS.dots
      return `${make(`color-mix(in srgb, ${pal.accent} 16%, transparent)`, Number(theme.patternSize) || 22)}, ${pal.bg}`
    }
    default:
      return pal.bg
  }
}

export function resolveMode(theme) {
  if (theme.allowToggle !== false) {
    try {
      const saved = localStorage.getItem('od-mode')
      if (saved === 'light' || saved === 'dark') return saved
    } catch {
      // 저장소를 못 쓰는 환경이면 기본값으로
    }
  }
  if (theme.mode === 'light' || theme.mode === 'dark') return theme.mode
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme, mode) {
  const root = document.documentElement
  const pal = mode === 'dark' ? theme.dark : theme.light
  const vars = {
    '--accent': pal.accent,
    '--on-accent': pal.accentText || '#fff',
    '--accent-soft': `color-mix(in srgb, ${pal.accent} 14%, transparent)`,
    '--bg': pal.bg,
    '--bg2': pal.bg2,
    '--surface': pal.surface,
    '--surface-2': pal.surface2,
    '--text': pal.text,
    '--text-sub': pal.textSub,
    '--line': pal.line,
    '--drawer-bg': pal.drawer,
    '--memo-bg': pal.memo,
    '--memo-text': pal.memoText,
    '--page-bg': pageBackground(theme, pal, mode),
    '--font': fontFamily(theme.font, theme),
    '--heading-font': theme.headingFont === 'same' ? 'var(--font)' : fontFamily(theme.headingFont, theme),
    '--font-scale': theme.fontScale,
    '--title-weight': theme.titleWeight,
    '--letter-spacing': `${theme.letterSpacing}em`,
    '--body-line': theme.lineHeight,
    '--radius': `${theme.radius}px`,
    '--radius-sm': `${Math.max(4, Math.round(theme.radius * 0.6))}px`,
    '--gap': `${theme.gap}px`,
    '--content-width': `${theme.contentWidth}px`,
    '--expanded-height': `${theme.expandedHeight}vh`,
    '--title-top': `${Number(theme.titleTop ?? 72)}px`,
    '--gallery-cols': theme.galleryColumns,
    '--topbar-bg':
      theme.topbarStyle === 'transparent'
        ? 'transparent'
        : theme.topbarStyle === 'solid'
          ? pal.bg
          : `color-mix(in srgb, ${pal.bg} ${Math.max(0, Math.min(100, Number(theme.topbarOpacity ?? 82)))}%, transparent)`,
    '--topbar-blur': theme.topbarStyle === 'blur' ? 'blur(16px) saturate(1.4)' : 'none',
    '--frame-bg': `color-mix(in srgb, ${pal.bg} ${Math.max(30, Math.min(100, Number(theme.frameOpacity ?? 92)))}%, transparent)`,
    '--frame-top': `${Number(theme.frameTop ?? 14)}px`,
    '--frame-width': Number(theme.frameWidth) > 0 ? `${Number(theme.frameWidth)}px` : `${theme.contentWidth}px`,
    '--scrollbar': theme.scrollbarColor || `color-mix(in srgb, ${pal.accent} 55%, transparent)`,
    '--home-title-height': `${Number(theme.homeTitleHeight ?? 14)}vh`,
    '--btn-radius': theme.buttonShape === 'pill' ? '999px' : theme.buttonShape === 'square' ? '6px' : 'var(--radius-sm)',
  }
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, String(v))

  // 단색이 아니면 페이지를 #root 안에서 스크롤해요. 그래야 스크롤바 뒤(바깥 줄)에도 배경이 그대로 보여요.
  // 스크롤하는 곳(창 ↔ #root)이 바뀔 때는 보던 위치를 그대로 옮겨서 맨 위로 튀지 않게 해요.
  const inner = !!theme.bgType && theme.bgType !== 'solid'
  const wasInner = root.classList.contains('inner-scroll')
  if (inner !== wasInner) {
    const el = document.getElementById('root')
    const y = wasInner ? el?.scrollTop || 0 : window.scrollY
    root.classList.toggle('inner-scroll', inner)
    if (inner) {
      if (el) el.scrollTop = y
    } else {
      window.scrollTo(0, y)
    }
  }
  root.dataset.mode = mode
  root.dataset.card = theme.cardStyle
  root.dataset.header = theme.headerStyle
  root.dataset.nav = theme.navStyle
  root.dataset.drawer = theme.drawerSide
  root.dataset.anim = theme.animations ? 'on' : 'off'
  root.dataset.lift = theme.hoverLift ? 'on' : 'off'
  root.dataset.icons = theme.iconStyle
  root.style.colorScheme = mode

  const bgImage = mode === 'dark' && theme.bgImageDark ? theme.bgImageDark : theme.bgImage
  const bgCss =
    theme.bgType === 'image' && bgImage
      ? `body::before { content: ""; position: fixed; inset: ${-theme.bgBlur * 2}px; z-index: -2;
          background: url("${bgImage.replace(/"/g, '%22')}") center / ${theme.bgFit === 'repeat' ? 'auto' : theme.bgFit} ${theme.bgFit === 'repeat' ? 'repeat' : 'no-repeat'};
          filter: blur(${theme.bgBlur}px); }
        body::after { content: ""; position: fixed; inset: 0; z-index: -1; background: ${pal.bg}; opacity: ${theme.bgOverlay}; }
        body { background: ${pal.bg}; }`
      : ''
  const fontFace = theme.customFontUrl
    ? `@font-face { font-family: 'OD Custom Font'; src: url("${theme.customFontUrl.replace(/"/g, '%22')}"); font-display: swap; }`
    : ''
  // 글을 쓰는 칸에서는 글자 커서(I)를 그대로 둡니다.
  const textCursor = theme.cursor !== 'default' ? 'input:not([type=checkbox]):not([type=range]):not([type=color]), textarea, [contenteditable="true"] { cursor: text; }' : ''
  styleTag('od-theme-extra').textContent = `${fontFace}\n${bgCss}\n${cursorCss(theme, pal)}\n${textCursor}`
  styleTag('od-custom-css').textContent = theme.customCss || ''

  const meta = document.querySelector('meta[name="theme-color"]') || document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'theme-color' }))
  meta.content = pal.bg
}

export function setFavicon(value) {
  if (!value) return
  let link = document.querySelector('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  if (/^(https?:|\/)/.test(value)) link.href = value
  else link.href = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${value}</text></svg>`)}`
}
