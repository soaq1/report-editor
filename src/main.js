import {
  createIcons, AlignCenter, AlignJustify, AlignLeft, AlignRight, Baseline, Bold, FileDown, FilePlus,
  FolderOpen, Italic, List, ListOrdered, Minus, PanelRight, Plus, Redo2, Save, Strikethrough,
  Subscript, Superscript, Underline, Undo2,
} from 'lucide'
import { EditorState } from '@tiptap/pm/state'
import './style.css'
import { createEditor } from './editor.js'
import { bindUi, stepFontSize } from './ui.js'
import { isMac } from './keys.js'

createIcons({
  icons: {
    AlignCenter, AlignJustify, AlignLeft, AlignRight, Baseline, Bold, FileDown, FilePlus, FolderOpen,
    Italic, List, ListOrdered, Minus, PanelRight, Plus, Redo2, Save, Strikethrough, Subscript,
    Superscript, Underline, Undo2,
  },
})

const AUTOSAVE_KEY = 'report-editor:autosave'
const PREFS_KEY = 'report-editor:prefs'
const FILE_FORMAT = 'report-editor'
const UNTITLED = '제목 없는 보고서'
const PAGE_WIDTH_MM = 210
const PAGE_HEIGHT_MM = 297
const SCREEN_GAP = 24
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2]

const defaultSettings = () => ({
  margins: { top: 25.4, bottom: 25.4, left: 25.4, right: 25.4 },
  pageNumbers: true,
})

const mm = (value) => (value * 96) / 25.4

const $ = (id) => document.getElementById(id)
const sheet = $('sheet')
const pageLayer = $('page-layer')
const sizer = $('zoom-sizer')
const titleInput = $('doc-title')
const statusEl = $('save-status')
const inspector = $('inspector')

const storage = {
  get(key) {
    try {
      return JSON.parse(localStorage.getItem(key))
    } catch {
      return null
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {}
  },
}

const prefs = { zoom: 1, panel: true, tab: 'format', ...storage.get(PREFS_KEY) }
const savePrefs = () => storage.set(PREFS_KEY, prefs)

const restored = storage.get(AUTOSAVE_KEY)
const state = {
  title: restored?.title || UNTITLED,
  settings: { ...defaultSettings(), ...restored?.settings },
  fileHandle: null,
  // true once there are edits not yet written to a file
  dirty: Boolean(restored?.dirty),
  gap: SCREEN_GAP,
  pages: 1,
}

const geometry = () => ({
  pageHeight: mm(PAGE_HEIGHT_MM),
  gap: state.gap,
  marginTop: mm(state.settings.margins.top),
  marginBottom: mm(state.settings.margins.bottom),
})

let ui
const editor = createEditor({
  element: $('editor'),
  content: restored?.content ?? '',
  getGeometry: geometry,
  onLayout: ({ pages }) => renderPages(pages),
  onUpdate: () => {
    markDirty()
    showTextStats()
  },
  onTransaction: () => ui?.sync(),
})

ui = bindUi({
  getEditor: () => editor,
  actions: {
    newDoc,
    openDoc,
    saveDoc,
    exportPdf,
    togglePanel: () => setPanel(!prefs.panel),
    setZoom,
  },
})

// ---- pages -------------------------------------------------------------

let pagesKey = ''
function renderPages(count) {
  const { pageHeight, gap } = geometry()
  const key = [count, gap, state.settings.pageNumbers, state.settings.margins.bottom].join()
  state.pages = count
  ui?.showStats({ pages: count })
  if (key === pagesKey) return
  pagesKey = key

  const pages = Array.from({ length: count }, (_, i) => {
    const page = document.createElement('div')
    page.className = 'page'
    page.style.top = `${i * (pageHeight + gap)}px`
    if (state.settings.pageNumbers) {
      const number = document.createElement('span')
      number.className = 'page-number'
      number.style.bottom = `${mm(state.settings.margins.bottom) / 2}px`
      number.textContent = i + 1
      page.append(number)
    }
    return page
  })
  pageLayer.replaceChildren(...pages)

  // When printing, stop just short of the last page edge so no blank page follows.
  const height = count * pageHeight + (count - 1) * gap - (gap ? 0 : 2)
  sheet.style.height = `${height}px`
  editor.view.dom.style.minHeight = `${height}px`
  applyZoom()
}

function applySettings() {
  const { top, right, left } = state.settings.margins
  editor.view.dom.style.padding = `${mm(top)}px ${mm(right)}px 0 ${mm(left)}px`
  editor.view.dom.style.setProperty('--margin-top', `${mm(top)}px`)
  for (const input of document.querySelectorAll('[data-margin]')) {
    input.value = state.settings.margins[input.dataset.margin]
  }
  document.querySelector('[data-setting="pageNumbers"]').checked = state.settings.pageNumbers
  pagesKey = ''
  editor.storage.pagination.relayout()
}

// ---- zoom & panel ------------------------------------------------------

function applyZoom() {
  const height = parseFloat(sheet.style.height) || mm(PAGE_HEIGHT_MM)
  sheet.style.transform = `scale(${prefs.zoom})`
  sizer.style.width = `${mm(PAGE_WIDTH_MM) * prefs.zoom}px`
  sizer.style.height = `${height * prefs.zoom}px`
  for (const select of document.querySelectorAll('[data-control="zoom"]')) select.value = String(prefs.zoom)
}

function setZoom(zoom) {
  prefs.zoom = zoom
  savePrefs()
  applyZoom()
  editor.commands.focus()
}

function stepZoom(direction) {
  const index = ZOOMS.indexOf(prefs.zoom)
  const next = ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, (index < 0 ? 2 : index) + direction))]
  setZoom(next)
}

function setPanel(open) {
  prefs.panel = open
  savePrefs()
  inspector.hidden = !open
  document.querySelector('[data-cmd="togglePanel"]').classList.toggle('is-active', open)
}

function setTab(tab) {
  prefs.tab = tab
  savePrefs()
  for (const el of document.querySelectorAll('[data-tab]')) {
    el.classList.toggle('is-active', el.dataset.tab === tab)
    el.setAttribute('aria-selected', el.dataset.tab === tab)
  }
  for (const el of document.querySelectorAll('[data-pane]')) el.hidden = el.dataset.pane !== tab
}

for (const el of document.querySelectorAll('[data-tab]')) {
  el.addEventListener('click', () => setTab(el.dataset.tab))
}

// ---- document settings -------------------------------------------------

for (const input of document.querySelectorAll('[data-margin]')) {
  input.addEventListener('change', () => {
    const value = Math.min(60, Math.max(5, parseFloat(input.value) || 0))
    state.settings.margins[input.dataset.margin] = value
    applySettings()
    markDirty()
  })
}

document.querySelector('[data-setting="pageNumbers"]').addEventListener('change', (event) => {
  state.settings.pageNumbers = event.target.checked
  applySettings()
  markDirty()
})

// ---- title, stats, saving ----------------------------------------------

function setTitle(title) {
  state.title = title.trim() || UNTITLED
  titleInput.value = state.title
  document.title = `${state.title} — 보고서 편집기`
}

titleInput.addEventListener('change', () => {
  setTitle(titleInput.value)
  markDirty()
})
titleInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === 'Escape') {
    event.preventDefault()
    if (event.key === 'Escape') titleInput.value = state.title
    editor.commands.focus()
  }
})

function showTextStats() {
  const text = editor.getText()
  ui.showStats({
    words: editor.storage.characterCount.words(),
    chars: editor.storage.characterCount.characters(),
    charsNoSpace: text.replace(/\s/g, '').length,
  })
}

const snapshot = () => ({
  format: FILE_FORMAT,
  version: 1,
  title: state.title,
  settings: state.settings,
  content: editor.getJSON(),
})

let autosaveTimer = 0
function markDirty() {
  state.dirty = true
  showStatus()
  clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(autosave, 400)
}

function autosave() {
  storage.set(AUTOSAVE_KEY, { ...snapshot(), dirty: state.dirty })
}

function showStatus() {
  if (state.dirty) statusEl.textContent = '저장 안 됨 · 이 브라우저에 임시 보관 중'
  else statusEl.textContent = state.fileHandle ? `${state.fileHandle.name}에 저장됨` : '저장됨'
}

const fileName = () => `${state.title.replace(/[\\/:*?"<>|]/g, '_')}.json`
const FILE_TYPES = [{ description: '보고서 파일', accept: { 'application/json': ['.json'] } }]

async function saveDoc() {
  const json = JSON.stringify(snapshot(), null, 2)
  try {
    if (window.showSaveFilePicker) {
      state.fileHandle ??= await window.showSaveFilePicker({ suggestedName: fileName(), types: FILE_TYPES })
      const writable = await state.fileHandle.createWritable()
      await writable.write(json)
      await writable.close()
    } else {
      const link = document.createElement('a')
      link.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      link.download = fileName()
      link.click()
      URL.revokeObjectURL(link.href)
    }
  } catch (error) {
    if (error.name === 'AbortError') return
    throw error
  }
  state.dirty = false
  autosave()
  showStatus()
}

async function openDoc() {
  let file
  try {
    if (window.showOpenFilePicker) {
      const [handle] = await window.showOpenFilePicker({ types: FILE_TYPES })
      file = await handle.getFile()
      state.fileHandle = handle
    } else {
      file = await pickFile()
      state.fileHandle = null
    }
  } catch (error) {
    if (error.name === 'AbortError') return
    throw error
  }
  if (!file) return
  let data
  try {
    data = JSON.parse(await file.text())
  } catch {}
  if (data?.format !== FILE_FORMAT) {
    statusEl.textContent = '보고서 파일이 아니에요'
    return
  }
  loadDoc(data)
  state.dirty = false
  autosave()
  showStatus()
}

function pickFile() {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.json' })
    input.addEventListener('change', () => resolve(input.files[0]))
    input.click()
  })
}

function newDoc() {
  if (state.dirty && !editor.isEmpty && !confirm('저장하지 않은 내용이 사라져요. 새 문서를 열까요?')) return
  state.fileHandle = null
  loadDoc({ title: UNTITLED, settings: defaultSettings(), content: '' })
  state.dirty = false
  autosave()
  statusEl.textContent = '새 문서'
}

// Replaces the whole editor state so undo history starts fresh.
function loadDoc({ title, settings, content }) {
  setTitle(title || UNTITLED)
  state.settings = { ...defaultSettings(), ...settings }
  const doc = content
    ? editor.schema.nodeFromJSON(content)
    : editor.schema.topNodeType.createAndFill()
  editor.view.updateState(EditorState.create({ doc, plugins: editor.state.plugins }))
  applySettings()
  showTextStats()
  ui.sync()
  editor.commands.focus('start')
}

// ---- keyboard ----------------------------------------------------------

window.addEventListener('keydown', (event) => {
  const mod = isMac ? event.metaKey : event.ctrlKey
  if (!mod || event.defaultPrevented) return
  const key = event.key.toLowerCase()
  const handled = (() => {
    if (key === 's' && !event.shiftKey && !event.altKey) return saveDoc()
    if (key === 'o' && !event.shiftKey && !event.altKey) return openDoc()
    if (event.shiftKey && event.code === 'Period') return stepFontSize(editor, 1)
    if (event.shiftKey && event.code === 'Comma') return stepFontSize(editor, -1)
    if (event.altKey || event.shiftKey) return false
    if (key === '=' || key === '+') return stepZoom(1)
    if (key === '-') return stepZoom(-1)
    if (key === '0') return setZoom(1)
    return false
  })()
  if (handled !== false) event.preventDefault()
})

// ---- printing / PDF ----------------------------------------------------

// On paper the pages touch, so lay the document out again without the gap.
// The browser's own print menu goes through beforeprint/afterprint too.
function setPrintLayout(printing) {
  const gap = printing ? 0 : SCREEN_GAP
  if (state.gap === gap) return
  state.gap = gap
  if (printing) document.title = state.title
  else setTitle(state.title)
  pagesKey = ''
  editor.storage.pagination.relayout()
}

function exportPdf() {
  setPrintLayout(true)
  window.print()
}

window.addEventListener('beforeprint', () => setPrintLayout(true))
window.addEventListener('afterprint', () => setPrintLayout(false))

// ---- start -------------------------------------------------------------

setTitle(state.title)
setPanel(prefs.panel)
setTab(prefs.tab)
applySettings()
showTextStats()
ui.sync()
if (restored) showStatus()
else statusEl.textContent = '새 문서'
editor.commands.focus('end')
