import { FONT_GROUPS, DEFAULT_FONT, fontCss, fontFromCss, isInstalled } from './fonts.js'
import { formatKeys, SHORTCUTS } from './keys.js'

const SIZES = [8, 9, 10, 10.5, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72]

const chain = (editor) => editor.chain().focus()

// Editor commands shared by the top toolbar and the right panel.
const EDITOR_COMMANDS = {
  undo: { run: (e) => chain(e).undo().run(), enabled: (e) => e.can().undo() },
  redo: { run: (e) => chain(e).redo().run(), enabled: (e) => e.can().redo() },
  bold: { run: (e) => chain(e).toggleBold().run(), active: (e) => e.isActive('bold') },
  italic: { run: (e) => chain(e).toggleItalic().run(), active: (e) => e.isActive('italic') },
  underline: { run: (e) => chain(e).toggleUnderline().run(), active: (e) => e.isActive('underline') },
  strike: { run: (e) => chain(e).toggleStrike().run(), active: (e) => e.isActive('strike') },
  subscript: { run: (e) => chain(e).toggleSubscript().run(), active: (e) => e.isActive('subscript') },
  superscript: { run: (e) => chain(e).toggleSuperscript().run(), active: (e) => e.isActive('superscript') },
  alignLeft: { run: (e) => chain(e).setTextAlign('left').run(), active: (e) => e.isActive({ textAlign: 'left' }) },
  alignCenter: { run: (e) => chain(e).setTextAlign('center').run(), active: (e) => e.isActive({ textAlign: 'center' }) },
  alignRight: { run: (e) => chain(e).setTextAlign('right').run(), active: (e) => e.isActive({ textAlign: 'right' }) },
  alignJustify: { run: (e) => chain(e).setTextAlign('justify').run(), active: (e) => e.isActive({ textAlign: 'justify' }) },
  bulletList: { run: (e) => chain(e).toggleBulletList().run(), active: (e) => e.isActive('bulletList') },
  orderedList: { run: (e) => chain(e).toggleOrderedList().run(), active: (e) => e.isActive('orderedList') },
  styleParagraph: { run: (e) => chain(e).setParagraph().run(), active: (e) => blockStyle(e) === 'paragraph' },
  styleH1: { run: (e) => chain(e).setHeading({ level: 1 }).run(), active: (e) => blockStyle(e) === 'h1' },
  styleH2: { run: (e) => chain(e).setHeading({ level: 2 }).run(), active: (e) => blockStyle(e) === 'h2' },
  fontBigger: { run: (e) => stepFontSize(e, 1) },
  fontSmaller: { run: (e) => stepFontSize(e, -1) },
}

function blockStyle(editor) {
  if (editor.isActive('heading', { level: 1 })) return 'h1'
  if (editor.isActive('heading', { level: 2 })) return 'h2'
  return 'paragraph'
}

// The size actually on screen at the cursor, whether it was set by hand or
// comes from the paragraph style.
function currentFontSize(editor) {
  const { view, state } = editor
  let { node } = view.domAtPos(state.selection.from)
  if (node.nodeType !== Node.ELEMENT_NODE) node = node.parentElement
  const px = parseFloat(getComputedStyle(node).fontSize)
  return Math.round(px * 0.75 * 2) / 2
}

export function stepFontSize(editor, direction) {
  const current = currentFontSize(editor)
  const next =
    direction > 0
      ? (SIZES.find((size) => size > current) ?? current + 4)
      : (SIZES.findLast((size) => size < current) ?? Math.max(1, current - 1))
  chain(editor).setFontSize(`${next}pt`).run()
}

function fillFontSelects() {
  for (const select of document.querySelectorAll('[data-control="fontFamily"]')) {
    for (const group of FONT_GROUPS) {
      const optgroup = document.createElement('optgroup')
      optgroup.label = group.label
      for (const font of group.fonts) {
        const option = new Option(isInstalled(font) ? font.label : `${font.label} (없음)`, font.family)
        optgroup.append(option)
      }
      select.append(optgroup)
    }
  }
}

function addTooltips() {
  for (const el of document.querySelectorAll('[data-tip]')) {
    el.title = el.dataset.keys ? `${el.dataset.tip} (${formatKeys(el.dataset.keys)})` : el.dataset.tip
  }
}

function fillKeyList() {
  const list = document.getElementById('key-list')
  for (const [label, keys] of SHORTCUTS) {
    const dt = document.createElement('dt')
    dt.textContent = label
    const dd = document.createElement('dd')
    dd.append(Object.assign(document.createElement('kbd'), { textContent: formatKeys(keys) }))
    list.append(dt, dd)
  }
}

export function bindUi({ getEditor, actions }) {
  fillFontSelects()
  addTooltips()
  fillKeyList()

  const controls = (name) => document.querySelectorAll(`[data-control="${name}"]`)

  // Keep the editor's selection when a toolbar button is clicked.
  document.addEventListener('mousedown', (event) => {
    if (event.target.closest('button[data-cmd]')) event.preventDefault()
  })

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-cmd]')
    if (!button || button.disabled) return
    const name = button.dataset.cmd
    if (EDITOR_COMMANDS[name]) EDITOR_COMMANDS[name].run(getEditor())
    else actions[name]?.()
  })

  for (const select of controls('blockStyle')) {
    select.addEventListener('change', () => {
      EDITOR_COMMANDS[{ paragraph: 'styleParagraph', h1: 'styleH1', h2: 'styleH2' }[select.value]].run(getEditor())
    })
  }

  for (const select of controls('fontFamily')) {
    select.addEventListener('change', () => {
      const font = fontFromCss(select.value)
      chain(getEditor()).setFontFamily(fontCss(font)).run()
    })
  }

  for (const input of controls('fontSize')) {
    const apply = () => {
      const size = parseFloat(input.value)
      if (size > 0) chain(getEditor()).setFontSize(`${size}pt`).run()
    }
    input.addEventListener('change', apply)
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        apply()
      }
    })
  }

  for (const input of controls('color')) {
    input.addEventListener('input', () => getEditor().chain().setColor(input.value).run())
    input.addEventListener('change', () => getEditor().commands.focus())
  }

  for (const select of controls('lineHeight')) {
    select.addEventListener('change', () => chain(getEditor()).setParagraphLineHeight(select.value).run())
  }

  for (const select of controls('zoom')) {
    select.addEventListener('change', () => actions.setZoom(parseFloat(select.value)))
  }

  function sync() {
    const editor = getEditor()
    for (const el of document.querySelectorAll('[data-cmd]')) {
      const command = EDITOR_COMMANDS[el.dataset.cmd]
      if (!command) continue
      if (command.active) {
        const on = command.active(editor)
        el.classList.toggle('is-active', on)
        el.setAttribute('aria-pressed', on)
      }
      if (command.enabled) el.disabled = !command.enabled(editor)
    }

    const style = blockStyle(editor)
    const font = fontFromCss(editor.getAttributes('textStyle').fontFamily) ?? DEFAULT_FONT
    const size = currentFontSize(editor)
    const color = editor.getAttributes('textStyle').color || '#111111'
    const lineHeight = editor.getAttributes(style === 'paragraph' ? 'paragraph' : 'heading').lineHeight ?? ''

    for (const el of controls('blockStyle')) el.value = style
    for (const el of controls('fontFamily')) el.value = font.family
    for (const el of controls('fontSize')) if (document.activeElement !== el) el.value = size
    for (const el of controls('color')) el.value = toHex(color)
    for (const el of document.querySelectorAll('[data-swatch]')) el.style.background = color
    for (const el of controls('lineHeight')) el.value = lineHeight
  }

  function showStats({ pages, words, chars, charsNoSpace }) {
    const set = (name, value) => {
      if (value !== undefined) document.querySelector(`[data-stat="${name}"]`).textContent = value.toLocaleString()
    }
    set('pages', pages)
    set('words', words)
    set('chars', chars)
    set('charsNoSpace', charsNoSpace)
  }

  return { sync, showStats }
}

function toHex(color) {
  if (color.startsWith('#') && color.length === 7) return color
  const ctx = document.createElement('canvas').getContext('2d')
  ctx.fillStyle = color
  return ctx.fillStyle
}
