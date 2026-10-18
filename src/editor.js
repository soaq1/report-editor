import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { TextStyleKit } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { CharacterCount, Placeholder } from '@tiptap/extensions'
import { Pagination } from './pagination.js'
import { ParagraphLineHeight } from './line-height.js'

export function createEditor({ element, content, getGeometry, onLayout, onUpdate, onTransaction }) {
  return new Editor({
    element,
    content,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        link: false,
        // Word and Pages don't keep a spare empty paragraph at the end.
        trailingNode: false,
      }),
      TextStyleKit.configure({ lineHeight: false, backgroundColor: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Subscript,
      Superscript,
      CharacterCount,
      Placeholder.configure({ placeholder: '여기에 보고서를 쓰세요' }),
      ParagraphLineHeight,
      Pagination.configure({ getGeometry, onLayout }),
    ],
    editorProps: { attributes: { spellcheck: 'false' } },
    onUpdate,
    onTransaction,
  })
}
