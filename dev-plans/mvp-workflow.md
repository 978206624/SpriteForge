---
feature_slug: mvp-workflow
status: active
depends_on: []
owners: []
---

# Development Plan — SpriteForge MVP 四步骤工作流

> 本文件记录 SpriteForge MVP「四步骤工作流（导入 → 提取与抠图 → 预览与帧管理 → 导出）」的开发阶段划分、当前进度和剩余工作。
> 参照 Product-Spec.md v0.2、Design-Brief.md、design/untitled.pen（8 屏设计稿）。
> 新 session 启动时，dev-builder 会列出 dev-plans/ 下所有 active plan，由用户选择继续哪一份。

---

## 项目位置

- 仓库根：E:\code\SpriteForge
- 子项目：`spriteforge/`（Next.js 应用，本 plan 所有代码都在此目录下）
- 改动范围：`spriteforge/` 全量（app/ + components/step-* + lib/ + workers/ + types/）

## 总体目标

1. 搭建 Next.js 工作台骨架 + 设计系统 + 四步骤向导外壳（深色默认/浅色可切，橙红主色）
2. 跑通核心流程：导入视频 → 提取全部帧 → 逐帧抠图（调一帧·应用全部·单帧微调）→ 动画预览与帧管理 → 导出 Sprite Sheet / PNG 序列 / ZIP
3. 接入 Clerk 登录与三天试用闸门：游客全程可用前三步，仅导出触发登录
4. 全程视频本地处理、不上传服务器；导出在浏览器内打包

---

## Phase 1: 项目骨架 + 设计系统 + 工作台外壳 ⏳

**交付内容**：
- 用 create-next-app 初始化 `spriteforge/`（Next.js 16.2.x + React 19 + TypeScript + App Router + Turbopack + Tailwind v4）
- shadcn/ui init，安装基础组件：button、dialog、slider、switch、tooltip、tabs、scroll-area
- 设计 tokens：按 Design-Brief 在 globals.css 定义颜色变量（bg-base/panel/elevated、text、border、brand 橙红 #FF6A2B、brand-soft、checker-a/b、语义色）、圆角、字体（Inter + Roboto Mono）；深色默认 + 浅色，用 next-themes 切换
- 工作台外壳：顶栏 TopBar（Logo + GitHub/Docs + 登录/头像槽位占位）、四段步骤指示器 Stepper（当前态橙红/完成态打勾/未达态灰，可点已完成步回退）、底部导航 BottomNav（上一步/下一步）
- 工作流全局状态（Zustand）：当前步骤、视频、帧集合、抠图参数等的 store 骨架
- 核心类型定义（VideoMeta、Frame、ChromaParams、LoopRange 等）

**关键文件**：
- `spriteforge/app/layout.tsx` — 根布局，ThemeProvider，字体加载
- `spriteforge/app/page.tsx` — 工作台容器，按当前步骤渲染对应 step 组件（先占位）
- `spriteforge/app/globals.css` — 设计 tokens（颜色/圆角/字体，深浅双主题）
- `spriteforge/components/top-bar.tsx` — 顶栏
- `spriteforge/components/stepper.tsx` — 四段步骤指示器
- `spriteforge/components/bottom-nav.tsx` — 底部上一步/下一步
- `spriteforge/components/providers/theme-provider.tsx` — 主题
- `spriteforge/lib/store/workflow-store.ts` — Zustand 工作流状态
- `spriteforge/types/index.ts` — 核心类型

**验收标准**：
- TypeScript 编译无错误，`pnpm dev` 可启动
- 浏览器显示顶栏 + 四步指示器 + 底部导航，主区为占位
- 深色/浅色主题切换正常；点上一步/下一步可切换步骤（占位内容）

---

## Phase 2: 第一步 · 导入与设置 ⏳

**交付内容**：
- 视频导入：拖拽到导入区 + 点击选择本地文件；格式校验（接受 mp4/mov/webm；mkv 等不支持格式给降级提示"请转为 mp4/webm"）
- 视频加载到 `<video>` 元素并提取基础信息：文件名、分辨率、时长、估算帧率、文件大小
- 中央视频预览 + 播放/暂停
- 时间轴：抽样生成缩略图帧条带；in/out 手柄拖拽选导出区间，选中区间橙红高亮、区间外压暗
- 帧率选择药丸：原始 / 24 / 12 / 8 / 自定义 fps
- 实时显示预计导出帧数（fps × 区间时长）与预计大小（估算）
- 空状态：未导入时显示大拖拽区（提示"本地处理不上传"）

**关键文件**：
- `spriteforge/components/step-import/video-uploader.tsx` — 拖拽/选择 + 格式校验 + 空状态拖拽区
- `spriteforge/components/step-import/video-preview.tsx` — `<video>` 预览 + 播放控制
- `spriteforge/components/step-import/timeline-range.tsx` — 缩略图时间轴 + in/out 手柄
- `spriteforge/components/step-import/fps-select.tsx` — 帧率药丸
- `spriteforge/components/step-import/video-info.tsx` — 视频信息表 + 预计帧数/大小
- `spriteforge/lib/video/probe.ts` — 读取视频元信息 + 估算帧率
- `spriteforge/lib/video/thumbnails.ts` — 时间轴缩略图生成（seek + canvas）
- `spriteforge/lib/store/workflow-store.ts` — 增补 videoFile / videoMeta / inTime / outTime / fps（修改）

**验收标准**：
- 导入 mp4 后看到完整视频信息，预览可播放
- 拖动 in/out 选区间、选 fps，预计帧数随之实时变化
- 导入 mkv 触发降级提示而非崩溃；未导入显示空状态拖拽区

---

## Phase 3: 第二步A · 帧提取 + 帧网格 + 帧数据模型 ⏳

**交付内容**：
- 帧提取：按 in/out 区间与 fps，主线程驱动 `video.currentTime` 逐帧 seek，监听 `seeked` 后 `drawImage` 到（Offscreen）Canvas 取帧，转位图，写入 IndexedDB；提取进度回调
- 帧数据模型 + IndexedDB 仓库：每帧 `{ id, index, originalBitmap, overrideParams?, processedBitmap? }`
- 帧网格 UI：缩略图 + 帧序号，提取进度条，点击选中帧
- 「提取帧」动作 + 「重新提取」（清空已提取帧重来）

**关键文件**：
- `spriteforge/lib/video/extract.ts` — 提取编排（seek 循环 + 进度 + 写库）
- `spriteforge/workers/frame-extract.worker.ts` — 帧位图编码/缩略图生成（卸载主线程）
- `spriteforge/lib/frames/store.ts` — IndexedDB 帧仓库（idb）
- `spriteforge/lib/frames/model.ts` — 帧数据模型与类型
- `spriteforge/components/step-extract/frame-grid.tsx` — 帧网格容器
- `spriteforge/components/step-extract/frame-grid-item.tsx` — 单帧缩略图项（选中态/标记态）
- `spriteforge/components/step-extract/extract-button.tsx` — 提取触发 + 进度

**验收标准**：
- 点「提取帧」后进度跑完，帧网格显示 N 个原始帧缩略图（数量与预计帧数一致）
- 刷新页面后已提取帧从 IndexedDB 恢复，不丢失
- 「重新提取」可清空重来

**风险与限制**：
- 高帧率长区间帧数多、内存压力大 → 依赖 Phase 2 的预计帧数阈值提示；位图存 IndexedDB 而非全留内存

---

## Phase 4: 第二步B · 抠图引擎 + 帧编辑弹窗 + 应用到全部（命根子）⏳

**交付内容**：
- 抠图算法（Web Worker）：基于背景色的颜色距离阈值（tolerance）生成 alpha 蒙版 + feather 边缘羽化软化 + spill removal 去除绿/蓝边缘污染，输出带 alpha 的位图
- 帧编辑弹窗：左原图 / 右抠图后（棋盘格透明背景）左右并排对比；背景色（绿/蓝/黑/白预设 + HEX 输入 + 取色器在原图点像素取色回填 HEX）；tolerance / feather / spill 滑块（拖动 debounce 重算当前帧，带轻量 loading）
- 「应用到全部帧」：用当前帧参数批量处理所有帧（Worker + 进度条）
- 单帧覆盖：保存单帧 override 参数，仅重算该帧（覆盖全局参数）；帧网格显示抠图后透明效果，未抠净的帧加标记
- 棋盘格透明背景组件

**关键文件**：
- `spriteforge/workers/chroma-key.worker.ts` — 抠图算法（tolerance/feather/spill）
- `spriteforge/lib/image/chroma.ts` — 抠图参数模型 + Worker 调用编排（单帧/批量）
- `spriteforge/lib/image/eyedropper.ts` — 画面取色
- `spriteforge/components/step-extract/frame-edit-modal.tsx` — 帧编辑弹窗（对比 + 参数 + 应用按钮）
- `spriteforge/components/step-extract/chroma-key-panel.tsx` — 抠图参数控件（背景色/滑块）
- `spriteforge/components/shared/checkerboard.tsx` — 棋盘格透明背景
- `spriteforge/lib/store/workflow-store.ts` — 增补 globalChromaParams / 单帧 override（修改）

**验收标准**：
- 打开任意帧编辑弹窗，取色 + 调 tolerance/feather/spill，右侧实时看到抠图前后对比
- 点「应用到全部帧」后，帧网格所有帧变为透明结果
- 单帧微调只影响该帧，不动全局；调整不卡页面

---

## Phase 5: 第三步 · 资源预览与帧管理 ⏳

**交付内容**：
- 动画预览播放器：按设定 fps 用 requestAnimationFrame 连续播放处理后帧，播放/暂停/循环开关/调速，棋盘格背景看透明效果
- 删帧：帧条带单选/多选删除
- 查找重复帧：相邻帧感知哈希（aHash/dHash）或像素差异检测（Web Worker），列出近似帧建议 + 一键删除
- 标记循环区间：选起止帧标记动画循环段，预览无缝循环，循环信息写入工作流状态（供导出 config）

**关键文件**：
- `spriteforge/components/step-preview/animation-preview.tsx` — 动画播放器（棋盘格背景）
- `spriteforge/components/step-preview/frame-strip.tsx` — 帧条带（多选/删除/循环标记）
- `spriteforge/components/step-preview/dedup-panel.tsx` — 重复帧建议列表 + 删除
- `spriteforge/components/step-preview/loop-marker.tsx` — 循环区间标记
- `spriteforge/workers/dedup.worker.ts` — 重复帧检测（哈希/像素差异）
- `spriteforge/lib/frames/dedup.ts` — 检测编排
- `spriteforge/lib/frames/loop.ts` — 循环区间模型

**验收标准**：
- 动画预览能按 fps 流畅播放处理后帧，循环开关生效
- 删帧后序列实时更新；查重给出建议且能一键删除；标记循环区间后预览无缝循环
- 帧管理操作有二次确认或可撤销，避免误删

---

## Phase 6: 第四步 · 导出（Sprite Sheet + PNG 序列 + ZIP）⏳

**交付内容**：
- Sprite Sheet 打包（Canvas）：按每行帧数 / padding / margin 拼图；可选「裁剪透明边界」「统一帧尺寸」
- spritesheet.json 生成：每帧 filename / x / y / width / height / sourceWidth / sourceHeight / pivot（预留），格式方便 Godot / Unity 读取
- PNG 序列导出（frame_000001.png …）
- ZIP 资源包（JSZip）：`frames/` + `spritesheet/`（png+json）+ `config.json`（fps、in/out、抠图参数、单帧覆盖参数、循环区间、sheet 列数/padding/margin）
- 导出类型选择 UI（PNG 序列 / Sprite Sheet / ZIP）+ Sprite Sheet 参数面板 + 拼图预览
- 本 Phase 导出动作暂不接登录闸门，便于功能验证（闸门在 Phase 7 接入）

**关键文件**：
- `spriteforge/lib/spritesheet/pack.ts` — 拼图算法（列数/padding/margin + 裁剪/统一尺寸）
- `spriteforge/lib/spritesheet/json.ts` — spritesheet.json 生成
- `spriteforge/lib/export/zip.ts` — JSZip 打包 + config.json 组装
- `spriteforge/lib/export/png-sequence.ts` — PNG 序列导出
- `spriteforge/components/step-export/export-panel.tsx` — 导出类型选择 + 触发
- `spriteforge/components/step-export/spritesheet-panel.tsx` — Sprite Sheet 参数
- `spriteforge/components/step-export/sheet-preview.tsx` — 拼图预览

**验收标准**：
- 设 Sprite Sheet 参数后看到拼图预览随参数变化
- 导出 ZIP 下载，解压结构正确（frames/ + spritesheet/ + config.json），spritesheet.json 字段完整
- 导出全程在浏览器内完成，无网络上传

**风险与限制**：
- 本 Phase 导出对所有人可用（未接闸门）；Phase 7 接入后游客/试用过期会被拦

---

## Phase 7: 登录 + 导出权限闸门 + 三天试用 + 升级提示 ⏳

**交付内容**：
- Clerk 集成：ClerkProvider 包裹应用、clerkMiddleware、登录弹窗（文案"登录后即可导出 SpriteForge 生成的游戏素材。"）
- `useRequireLoginBeforeExport`：导出/保存配置动作前校验登录 + 试用期；未登录弹登录弹窗，登录成功后**自动继续刚才的导出动作**且保留视频/帧/参数；取消登录数据不清空
- 三天试用：服务端记录试用开始时间（Clerk user metadata），导出权限校验 API Route；过期 → 升级提示弹窗（月度/永久档占位，点击提示"支付即将上线"，不接真实支付）
- 顶栏接入登录/用户头像/试用徽章
- 保存项目配置（登录后）

**关键文件**：
- `spriteforge/app/layout.tsx` — 包 ClerkProvider（修改）
- `spriteforge/middleware.ts` — clerkMiddleware
- `spriteforge/app/api/export/route.ts` — 导出权限 + 试用期校验
- `spriteforge/lib/auth/use-require-login-before-export.ts` — 登录拦截 hook（含登录后续跑原动作）
- `spriteforge/lib/auth/trial.ts` — 三天试用逻辑（基于 Clerk metadata）
- `spriteforge/components/login-modal.tsx` — 登录弹窗
- `spriteforge/components/upgrade-modal.tsx` — 升级提示弹窗（占位，不接支付）
- `spriteforge/components/top-bar.tsx` — 接入登录/头像/徽章（修改）

**验收标准**：
- 游客点导出 → 弹登录弹窗 → 登录 → 自动继续导出，视频/帧/参数不丢
- 试用期内可正常导出；试用过期点导出 → 升级提示弹窗（占位）
- 取消登录停留当前页、数据不清空

**风险与限制**：
- 真实支付不做（升级为占位）；试用期开始时间用 Clerk user metadata 存储，无需自建数据库

---

## Phase 8: 错误处理 + 收尾 + 部署 ⏳

**交付内容**：
- 错误处理：格式不支持、视频过大/帧数过多预警、提取/抠图内存不足或崩溃、导出失败、登录后导出失败 —— 各场景给明确提示 + 可操作的下一步建议（对照 Spec 错误处理表）
- 性能兜底复查：参数 debounce、Worker 进度、大任务不阻塞 UI
- README（含 Roadmap：WebCodecs 高性能抽帧、ffmpeg.wasm 支持 mkv、AI 自动抠图、AI 补间插帧、自动裁剪透明边界/脚底锚点、批量处理、动作分段、Godot AnimatedSprite2D / Unity Sprite Metadata 导出、GIF/APNG、真实付费会员、项目云保存、团队协作）
- Vercel 部署配置 + 环境变量样例（Clerk keys）

**关键文件**：
- `spriteforge/components/shared/error-toast.tsx` — 错误提示
- `spriteforge/app/error.tsx` — 全局错误边界
- `spriteforge/lib/utils/limits.ts` — 帧数/文件大小阈值与预警
- `spriteforge/README.md` — 项目说明 + Roadmap
- `spriteforge/.env.example` — Clerk 环境变量样例

**验收标准**：
- 各错误场景显示正确、可操作的提示而非崩溃或静默失败
- `pnpm build` 通过；部署到 Vercel 后可访问完整流程

---

## Phase 依赖关系图

```
Phase 1 (骨架/设计系统/外壳)
   └─→ Phase 2 (导入与设置)
          └─→ Phase 3 (帧提取+帧网格)
                 └─→ Phase 4 (抠图+编辑弹窗+应用全部)
                        └─→ Phase 5 (预览+帧管理)
                               └─→ Phase 6 (导出 Sheet/PNG/ZIP)
                                      └─→ Phase 7 (登录+导出闸门+试用)
                                             └─→ Phase 8 (错误处理+收尾+部署)
```

**并行可行性**：主链基本线性（每步依赖前一步产出的数据：帧 → 抠图帧 → 帧集合 → 导出）。可并行点有限——Phase 8 的 README/错误提示可在 Phase 5-7 期间穿插；Phase 7 的 Clerk 基建（ClerkProvider/middleware）在不影响游客流程的前提下可提前接入。

**建议执行顺序**：单人按 Phase 1→8 顺序推进；若双人，A 走主链（1→6），B 在 Phase 1 完成后并行做 Phase 7 的 Clerk 登录基建与 Phase 8 的错误处理脚手架，最后汇合。

---

## 技术栈

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 框架 | Next.js + React | 16.2.x / React 19 | App Router + Turbopack，API Routes 做权限校验，Vercel 友好 |
| 语言 | TypeScript | 5.x | 类型安全 |
| UI | Tailwind CSS + shadcn/ui | Tailwind v4 | 工具型 UI，shadcn 组件现成，与 Clerk 官方兼容 |
| 状态管理 | Zustand | 5.x | 工作流全局状态（步骤/视频/帧/参数），轻量 |
| 认证 | Clerk (@clerk/nextjs) | latest | 免费 1 万 MAU，App Router 集成最快；视频不经过它，不影响隐私 |
| 视频抽帧 | HTMLVideoElement + Canvas/OffscreenCanvas | 浏览器原生 | 零依赖、全浏览器支持；WebCodecs/ffmpeg.wasm 列 Roadmap |
| 图像处理 | Web Workers + Canvas | 浏览器原生 | 抠图/批量应用/重复帧检测卸载主线程，不卡 UI |
| 本地存储 | IndexedDB (idb) | latest | 帧位图本地存储，刷新不丢，绝不上传 |
| 打包 | JSZip | latest | 前端打包 ZIP 资源包 |
| 包管理 | pnpm | 10.x | 快速、磁盘高效 |
| 运行时 | Node.js | 20+ | Next.js 16 最低要求 |
| 部署 | Vercel | — | 零运维，免费额度够 MVP |

## 数据库变更

无服务端数据库。
- 用户与登录：Clerk 托管
- 三天试用开始时间：存 Clerk user metadata（Phase 7）
- 视频与帧位图：浏览器 IndexedDB（Phase 3），不上传服务器

## 开发规则

- 每完成一个 Phase 执行四步走：Code Review → 测试完整性 → 编译验证 → 功能测试
- 四步走全部通过后才能进入待 commit 状态（commit 须用户显式授权）
- Commit message 格式：`phase-N [mvp-workflow]: 简要描述`（带 plan 前缀便于多人协作时定位）
- 包管理器：pnpm
- 设计参照优先级：design/untitled.pen 设计稿（最高）→ Design-Brief.md → Product-Spec.md
- 隐私红线：任何 Phase 都不得默认上传用户视频；服务端只做登录与导出权限校验

## 跨 plan 协作注意

- 本 plan 当前是唯一 active plan，无跨 plan 依赖（depends_on 为空）
- 后续如拆分新主题（如 ai-matting、cloud-save），新建独立 plan 文件，不污染本 plan
