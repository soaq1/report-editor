// `web` fonts are loaded from Google Fonts in index.html, so every computer has
// them. The rest are only there if the computer already has them installed.
export const FONT_GROUPS = [
  {
    label: '한글',
    fonts: [
      { label: '맑은 고딕', family: 'Malgun Gothic', alt: '맑은 고딕', generic: 'sans-serif' },
      { label: '나눔고딕', family: 'Nanum Gothic', generic: 'sans-serif', web: true },
      { label: '나눔명조', family: 'Nanum Myeongjo', generic: 'serif', web: true },
      { label: '본고딕 (Noto Sans KR)', family: 'Noto Sans KR', generic: 'sans-serif', web: true },
      { label: '본명조 (Noto Serif KR)', family: 'Noto Serif KR', generic: 'serif', web: true },
      { label: 'Apple SD 산돌고딕 Neo', family: 'Apple SD Gothic Neo', generic: 'sans-serif' },
      { label: '애플명조', family: 'AppleMyungjo', generic: 'serif' },
      { label: '바탕', family: 'Batang', alt: '바탕', generic: 'serif' },
      { label: '돋움', family: 'Dotum', alt: '돋움', generic: 'sans-serif' },
      { label: '굴림', family: 'Gulim', alt: '굴림', generic: 'sans-serif' },
      { label: '궁서', family: 'Gungsuh', alt: '궁서', generic: 'serif' },
    ],
  },
  {
    label: '영문',
    fonts: [
      { label: 'Times New Roman', family: 'Times New Roman', generic: 'serif' },
      { label: 'Arial', family: 'Arial', generic: 'sans-serif' },
      { label: 'Helvetica', family: 'Helvetica', generic: 'sans-serif' },
      { label: 'Georgia', family: 'Georgia', generic: 'serif' },
      { label: 'Calibri', family: 'Calibri', generic: 'sans-serif' },
      { label: 'Cambria', family: 'Cambria', generic: 'serif' },
      { label: 'Garamond', family: 'Garamond', generic: 'serif' },
      { label: 'Palatino', family: 'Palatino Linotype', alt: 'Palatino', generic: 'serif' },
      { label: 'Verdana', family: 'Verdana', generic: 'sans-serif' },
      { label: 'Courier New', family: 'Courier New', generic: 'monospace' },
    ],
  },
]

export const FONTS = FONT_GROUPS.flatMap((group) => group.fonts)
export const DEFAULT_FONT = FONTS[0]

export const fontCss = (font) =>
  [font.family, font.alt].filter(Boolean).map((name) => `"${name}"`).join(', ') + `, ${font.generic}`

// Matches a stored font-family value back to its entry by its first name.
export function fontFromCss(css) {
  if (!css) return null
  const first = css.split(',')[0].replace(/["']/g, '').trim()
  return FONTS.find((font) => font.family === first || font.alt === first) ?? null
}

let ctx
export function isInstalled(font) {
  if (font.web) return true
  ctx ??= document.createElement('canvas').getContext('2d')
  const sample = '가나다라마 mmmmmwwwwwlli 0123'
  return [font.family, font.alt].filter(Boolean).some((name) =>
    ['monospace', 'serif'].some((base) => {
      ctx.font = `40px ${base}`
      const fallback = ctx.measureText(sample).width
      ctx.font = `40px "${name}", ${base}`
      return ctx.measureText(sample).width !== fallback
    }),
  )
}
