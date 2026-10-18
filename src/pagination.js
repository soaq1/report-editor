import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

// The document is one continuous editable flow laid over a stack of A4 pages.
// Any top-level block that would run past a page's bottom margin gets
// padding-top that moves it to the top of the next page. The padding lives in
// decorations, so neither the saved document nor undo history ever sees it.
// When printing, the same blocks become forced page breaks instead (style.css).

export const paginationKey = new PluginKey('pagination')

function decorate(doc, pushes) {
  const decorations = []
  doc.forEach((node, offset, index) => {
    if (pushes[index] > 0) {
      decorations.push(
        Decoration.node(offset, offset + node.nodeSize, {
          class: 'page-start',
          style: `padding-top: ${pushes[index]}px`,
        }),
      )
    }
  })
  return DecorationSet.create(doc, decorations)
}

function measure(view, { pageHeight, gap, marginTop, marginBottom }) {
  const period = pageHeight + gap
  const contentHeight = pageHeight - marginTop - marginBottom
  const applied = paginationKey.getState(view.state).pushes
  const pushes = []
  // `removed` undoes the pushes currently on screen, `added` applies the new ones.
  let removed = 0
  let added = 0
  let bottom = 0

  view.state.doc.forEach((node, offset, index) => {
    const el = view.nodeDOM(offset)
    const old = applied[index] || 0
    if (!(el instanceof HTMLElement)) {
      pushes.push(0)
      return
    }
    const top = el.offsetTop - removed + added
    const height = el.offsetHeight - old
    removed += old

    const page = Math.floor(top / period)
    const contentBottom = page * period + pageHeight - marginBottom
    const startsPage = top <= page * period + marginTop + 1
    const overflows = top + height > contentBottom && height <= contentHeight && !startsPage
    const push = top >= contentBottom || overflows ? (page + 1) * period + marginTop - top : 0

    added += push
    pushes.push(push)
    bottom = top + push + height
  })

  return { pushes, pages: Math.max(1, Math.floor((bottom - 1) / period) + 1) }
}

// offsetTop is rounded to whole pixels, so treat sub-pixel differences as equal
// to avoid re-dispatching forever.
const samePushes = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1)

export const Pagination = Extension.create({
  name: 'pagination',

  addOptions() {
    return { getGeometry: null, onLayout: () => {} }
  },

  addStorage() {
    return { relayout: () => {} }
  },

  addProseMirrorPlugins() {
    const { options, storage } = this
    return [
      new Plugin({
        key: paginationKey,
        state: {
          init: () => ({ pushes: [], decorations: DecorationSet.empty }),
          apply(tr, value, _oldState, newState) {
            const pushes = tr.getMeta(paginationKey)
            if (pushes) return { pushes, decorations: decorate(newState.doc, pushes) }
            if (!tr.docChanged) return value
            return { pushes: value.pushes, decorations: decorate(newState.doc, value.pushes) }
          },
        },
        props: {
          decorations: (state) => paginationKey.getState(state).decorations,
        },
        view(view) {
          let frame = 0
          const relayout = () => {
            cancelAnimationFrame(frame)
            const { pushes, pages } = measure(view, options.getGeometry())
            if (!samePushes(pushes, paginationKey.getState(view.state).pushes)) {
              view.dispatch(view.state.tr.setMeta(paginationKey, pushes).setMeta('addToHistory', false))
            }
            options.onLayout({ pages })
          }
          const schedule = () => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(relayout)
          }
          storage.relayout = relayout
          document.fonts?.addEventListener('loadingdone', schedule)
          schedule()
          return {
            update(view, prevState) {
              if (view.state.doc !== prevState.doc) schedule()
            },
            destroy() {
              cancelAnimationFrame(frame)
              document.fonts?.removeEventListener('loadingdone', schedule)
            },
          }
        },
      }),
    ]
  },
})
