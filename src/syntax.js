import { Extension, InputRule, Mark, Node } from '@tiptap/core'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import katex from 'katex'
import 'katex/dist/katex.min.css'

// The report syntax. Each piece turns into its finished form the moment it is
// complete, right where it was typed:
//   [[[1. 실험 목표 + Enter    -> 대주제 (heading 1)
//   [[3.1 옴의 법칙 + Enter    -> 소주제 (heading 2)
//   ^^87V^^                   -> unit, upright Times New Roman, "87 V"
//   ~~V~~                     -> variable, italic Times New Roman
//   $$V = IR$$                -> LaTeX; on a line of its own it becomes a centred equation
// Backspace right after an equation (or on a selected one) turns it back into
// `$$…$` text so it can be edited and closed again.

// Replaces the matched syntax with `text` carrying `mark`.
function markRule(find, type, transform = (text) => text) {
  return new InputRule({
    find,
    handler: ({ state, range, match }) => {
      const text = transform(match[1])
      const { tr } = state
      tr.insertText(text, range.from, range.to)
      tr.addMark(range.from, range.from + text.length, type.create())
      tr.removeStoredMark(type)
    },
  })
}

// "87V" -> "87 V" with a no-break space, as SI writes it. Percent and plain
// degrees stay attached ("5%", "90°").
export function spaceUnit(text) {
  const match = text.trim().match(/^([-+−]?\d[\d.,]*(?:\s*[×x]\s*10\^?[-−]?\d+)?)\s*(\S.*)$/)
  if (!match) return text.trim()
  const [, number, unit] = match
  const attached = unit.startsWith('%') || (unit.startsWith('°') && !/^°[CF]/.test(unit))
  return attached ? number + unit : `${number} ${unit}`
}

export const Unit = Mark.create({
  name: 'unit',
  inclusive: false,
  excludes: 'variable',
  parseHTML: () => [{ tag: 'span.unit' }],
  renderHTML: () => ['span', { class: 'unit' }, 0],
  addInputRules() {
    return [markRule(/(?<!\^)\^\^([^\^\n]+?)\^\^$/, this.type, spaceUnit)]
  },
})

export const Variable = Mark.create({
  name: 'variable',
  inclusive: false,
  excludes: 'unit',
  parseHTML: () => [{ tag: 'span.variable' }],
  renderHTML: () => ['span', { class: 'variable' }, 0],
  addInputRules() {
    return [markRule(/(?<!~)~~([^~\n]+?)~~$/, this.type, (text) => text.trim())]
  },
})

function renderMath(dom, latex, displayMode) {
  katex.render(latex, dom, { displayMode, throwOnError: false })
}

const mathNodeView =
  (displayMode) =>
  ({ node }) => {
    const dom = document.createElement(displayMode ? 'div' : 'span')
    dom.className = displayMode ? 'math-block' : 'math-inline'
    dom.contentEditable = 'false'
    renderMath(dom, node.attrs.latex, displayMode)
    return {
      dom,
      update(updated) {
        if (updated.type !== node.type) return false
        renderMath(dom, updated.attrs.latex, displayMode)
        node = updated
        return true
      },
    }
  }

const latexAttr = {
  latex: {
    default: '',
    parseHTML: (el) => el.getAttribute('data-latex') ?? '',
    renderHTML: (attrs) => ({ 'data-latex': attrs.latex }),
  },
}

export const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => latexAttr,
  parseHTML: () => [{ tag: 'span[data-math-inline]' }],
  renderHTML: ({ HTMLAttributes }) => ['span', { 'data-math-inline': '', ...HTMLAttributes }],
  renderText: ({ node }) => node.attrs.latex,
  addNodeView: () => mathNodeView(false),
})

export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes: () => latexAttr,
  parseHTML: () => [{ tag: 'div[data-math-block]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', { 'data-math-block': '', ...HTMLAttributes }],
  renderText: ({ node }) => node.attrs.latex,
  addNodeView: () => mathNodeView(true),
})

const MATH = /(?<!\$)\$\$([^$\n]+?)\$\$$/

// `$$…$$` alone on a top-level line becomes a centred equation with a fresh
// line after it; anywhere else it stays inside the sentence.
const mathRule = (schema) =>
  new InputRule({
    find: MATH,
    handler: ({ state, range, match }) => {
      const latex = match[1].trim()
      const { tr } = state
      const $from = state.doc.resolve(range.from)
      const aloneOnLine =
        $from.depth === 1 && $from.parent.type.name === 'paragraph' &&
        range.from === $from.start() && range.to === $from.end()
      if (aloneOnLine) {
        const start = $from.before()
        tr.replaceWith(start, $from.after(), [
          schema.nodes.mathBlock.create({ latex }),
          schema.nodes.paragraph.create(),
        ])
        tr.setSelection(TextSelection.create(tr.doc, start + 2))
      } else {
        tr.replaceWith(range.from, range.to, schema.nodes.mathInline.create({ latex }))
      }
    },
  })

// Turns an equation back into editable `$$…$` text.
function unwrapMath(editor) {
  const { state } = editor
  const { selection, schema } = state
  let node
  let from
  if (selection instanceof NodeSelection && /^math/.test(selection.node.type.name)) {
    node = selection.node
    from = selection.from
  } else if (selection.empty && selection.$from.nodeBefore?.type.name === 'mathInline') {
    node = selection.$from.nodeBefore
    from = selection.from - node.nodeSize
  } else {
    return false
  }
  const text = schema.text(`$$${node.attrs.latex}$`)
  const tr = state.tr
  if (node.type.name === 'mathBlock') {
    tr.replaceWith(from, from + node.nodeSize, schema.nodes.paragraph.create(null, text))
    tr.setSelection(TextSelection.create(tr.doc, from + 1 + text.nodeSize))
  } else {
    tr.replaceWith(from, from + node.nodeSize, text)
    tr.setSelection(TextSelection.create(tr.doc, from + text.nodeSize))
  }
  editor.view.dispatch(tr.scrollIntoView())
  return true
}

const HEADING = /^(\[\[\[?)\s*/

// Enter at the end of a top-level line starting with [[[ or [[ makes it a
// heading and continues on a new body paragraph.
function convertHeading(editor) {
  const { selection } = editor.state
  const { $from } = selection
  if (!selection.empty || $from.depth !== 1 || $from.parent.type.name !== 'paragraph') return false
  if ($from.parentOffset !== $from.parent.content.size) return false
  const match = $from.parent.textContent.match(HEADING)
  if (!match) return false
  const level = match[1].length === 3 ? 1 : 2
  const start = $from.start()
  const chain = editor
    .chain()
    .command(({ tr }) => {
      tr.delete(start, start + match[0].length)
      return true
    })
    .setNode('heading', { level })
  // A bare `[[[` + Enter just opens an empty heading to type the title into.
  if (match[0].length === $from.parent.content.size) return chain.run()
  // Splitting at the end of a heading already continues with a body paragraph.
  return chain.splitBlock().run()
}

export const ReportSyntax = Extension.create({
  name: 'reportSyntax',
  priority: 1000,

  addInputRules() {
    return [mathRule(this.editor.schema)]
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => convertHeading(editor) || (editor.state.selection instanceof NodeSelection && unwrapMath(editor)),
      Backspace: ({ editor }) => unwrapMath(editor),
    }
  },
})
