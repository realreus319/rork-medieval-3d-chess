# 楚汉棋局 · 3D 中国象棋

这是对 [alexngdev99/rork-medieval-3d-chess](https://github.com/alexngdev99/rork-medieval-3d-chess) 的中国象棋改造版本。项目保留 Vite + React 19 + TypeScript + three.js 的浏览器三维技术路线，将原有西洋棋规则、8×8 棋盘和欧洲棋子体系替换为可直接对弈的中国象棋。

## 已实现

- 9×10 中国象棋棋盘、楚河汉界、九宫斜线与交叉点落子
- 帅/将、仕/士、相/象、马、车、炮/砲、兵/卒完整走法
- 蹩马腿、塞象眼、相不过河、炮架、兵卒过河、将帅照面
- 走子后自陷将军校验、将军提示、无合法着法判负
- 三维木质棋盘、程序化立体棋子、中文棋面、合法落点与吃子提示
- 旋转、缩放、翻转、俯视镜头以及移动、吃子动画
- 本地双人、人机对弈、三级搜索深度、Web Worker AI
- 悔棋、重新开局、棋谱记录、已吃棋子展示、响应式布局

## 开发

```bash
cd web
npm install
npm run dev
npm run build
npx vitest run src/xiangqi/core.test.ts
```

要求 Node.js 20+。项目为纯静态站点，无需后端或环境变量。

## 主要目录

```text
web/src/xiangqi/
├── core.ts            中国象棋状态、走法、将军与终局判定
├── core.test.ts       核心规则测试
├── ai.ts              估值、走法排序与 Alpha-Beta 搜索
├── aiClient.ts        主线程 AI 客户端
├── xiangqi.worker.ts  Web Worker 搜索入口
└── scene.ts           Three.js 棋盘、棋子、交互与动画
```

## 规则边界

当前实现覆盖日常对局所需的中国象棋合法着法、将军与终局判定。赛事级“长将、长捉、循环局面裁决”涉及竞赛规则中的复杂判罚语义，暂未自动裁决，后续可增加局面重复历史和裁判策略模块。

## 来源与许可

原项目采用 MIT License。本改造保留原许可证与来源说明。
