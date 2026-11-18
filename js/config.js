// Shared constants
export const VERSION = '1.2';   // bump on every upload (tools/stamp.py also uses it)
export const W = 1280, H = 720;
export const TITLE = 'WAGLE PARTY';
export const TITLE_KO = '와글와글 파티';

export const POINTS = [3, 2, 1, 0];         // points by place (1st..4th)
export const ROUND_OPTIONS = [3, 6, 10];
export const DIFFS = [
  { id: 'easy', name: '쉬움', k: 0.35 },
  { id: 'normal', name: '보통', k: 0.65 },
  { id: 'hard', name: '어려움', k: 1.0 },
];

export const FONT_T = "'Jua', 'Noto Sans KR', 'Noto Sans CJK KR', sans-serif";   // round, bundled in fonts/
export const FONT = "'Noto Sans KR', 'Noto Sans CJK KR', sans-serif";

export const COL = {
  bg: '#1b1824', panel: '#f1eaff', panel2: '#c4b5fd', line: '#d8cdfe', ink: '#43386e',
  text: '#ffffff', sub: '#e6e0ff', dim: '#b9aef2', accent: '#ffd76e', bad: '#ff8fa3', good: '#6fd69a',
  // pastel theme: text on light cards
  soft: '#6f63a3', faint: '#a49ccb', tint: '#efe8ff',
};
