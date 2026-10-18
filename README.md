# 보고서 편집기

IB 보고서를 마우스 없이 키보드만으로 쓰고 PDF로 내보내기 위한 웹 편집기.
A4 쪽이 이어지는 문서에 바로 쓰고, 내보내면 그대로 PDF 한 개가 된다.

## 실행

```
npm install
npm run dev
```

`main` 브랜치에 올리면 GitHub Actions가 빌드해서 GitHub Pages에 배포한다.

## 구조

- `src/main.js` — 문서 상태, 쪽 그리기, 저장·열기, 단축키, PDF 내보내기
- `src/editor.js` — Tiptap 편집기와 확장 목록
- `src/pagination.js` — 한 흐름의 글을 A4 쪽으로 나누는 확장
- `src/ui.js` — 위 툴바와 오른쪽 패널을 편집기에 연결
- `src/fonts.js` — 글꼴 목록과 설치 여부 확인
- `src/keys.js` — 단축키 표기와 목록

## 아직 안 되는 것

- 한 문단이 한 쪽보다 길면 쪽 사이에서 나뉘지 않는다.
- 보고서 문법(`[[[`, `[[`, `^^`, `$$` 등), 표지, 목차, 수식은 다음 단계.
