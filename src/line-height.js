import { Extension } from '@tiptap/core'

// Line spacing belongs to the whole paragraph, unlike the text-style kit's
// LineHeight which marks individual runs of text.
const TYPES = ['paragraph', 'heading']

export const ParagraphLineHeight = Extension.create({
  name: 'paragraphLineHeight',

  addGlobalAttributes() {
    return [
      {
        types: TYPES,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (el) => el.style.lineHeight || null,
            renderHTML: (attrs) => (attrs.lineHeight ? { style: `line-height: ${attrs.lineHeight}` } : {}),
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setParagraphLineHeight:
        (lineHeight) =>
        ({ commands }) =>
          TYPES.map((type) => commands.updateAttributes(type, { lineHeight: lineHeight || null })).some(Boolean),
    }
  },
})
