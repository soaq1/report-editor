export const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

const NAMES = isMac ? { Mod: '⌘', Shift: '⇧', Alt: '⌥' } : { Mod: 'Ctrl', Shift: 'Shift', Alt: 'Alt' }

// 'Mod-Shift-l' -> '⌘⇧L' on a Mac, 'Ctrl+Shift+L' elsewhere.
export const formatKeys = (keys) =>
  keys
    .split(/-(?=.)/)
    .map((key) => NAMES[key] ?? key.toUpperCase())
    .join(isMac ? '' : '+')

export const SHORTCUTS = [
  ['저장', 'Mod-s'],
  ['열기', 'Mod-o'],
  ['PDF로 내보내기', 'Mod-p'],
  ['실행 취소', 'Mod-z'],
  ['다시 실행', 'Mod-Shift-z'],
  ['대주제', 'Mod-Alt-1'],
  ['소주제', 'Mod-Alt-2'],
  ['본문', 'Mod-Alt-0'],
  ['굵게', 'Mod-b'],
  ['기울임', 'Mod-i'],
  ['밑줄', 'Mod-u'],
  ['취소선', 'Mod-Shift-s'],
  ['아래 첨자', 'Mod-,'],
  ['위 첨자', 'Mod-.'],
  ['글자 크게', 'Mod-Shift-.'],
  ['글자 작게', 'Mod-Shift-,'],
  ['왼쪽 정렬', 'Mod-Shift-l'],
  ['가운데 정렬', 'Mod-Shift-e'],
  ['오른쪽 정렬', 'Mod-Shift-r'],
  ['양쪽 정렬', 'Mod-Shift-j'],
  ['글머리 목록', 'Mod-Shift-8'],
  ['번호 목록', 'Mod-Shift-7'],
  ['확대', 'Mod-='],
  ['축소', 'Mod--'],
  ['100%로', 'Mod-0'],
]
