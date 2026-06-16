---
feature_slug: loop-detect-dedup
status: archived
depends_on: []
owners: []
---

# Development Plan — 循环点检测 + 相邻近似帧去黑盒化

> 本文件记录第三步「资源预览与帧管理」帧整理能力迭代（Product-Spec v0.7）的开发阶段划分、当前进度和剩余工作。
> 新 session 启动时，dev-builder 会列出 dev-plans/ 下所有 active plan，由用户选择继续哪一份。

---

## 项目位置

- 仓库根：E:\code\SpriteForge
- 子项目：spriteforge
- 改动范围：
  - `spriteforge/components/step-preview/`（dedup-panel 改造 + 新增 loop-detect-panel + 挂载）
  - `spriteforge/lib/frames/`（新增 loop-detect.ts）
  - `spriteforge/lib/image/`（抽出共享 phash 工具）
  - `spriteforge/workers/`（dedup worker 改用共享 hash + 新增 loop-detect worker）

## 总体目标

1. 把「扫描相邻近似帧」从黑盒批量删除改造为「只给建议 + 加入帧条带多选，由用户用现有『删除选中』自行删」。
2. 新增「检测循环点」：用感知哈希（dHash）比对非相邻帧，找出循环闭合点（帧 Y ≈ 帧 X，干净一圈 `[X, Y−1]`），列候选按相似度排序、默认高亮最佳。
3. 点选候选自动写入现有 loopRange；选中后提供「删除区间外多余帧」快捷入口（默认删前导 + 尾段、二次确认），亦可不删手动处理。

---

## Phase 1: 相邻近似帧去黑盒化（dedup-panel 改造）✅

**交付内容**：
- 移除 `dedup-panel.tsx` 的「删除全部 M 个重复帧」批量删除按钮及其二次确认分支（`confirming` / `deleteAll` / `deleting` 相关逻辑）。
- 扫描结果保持不变（仍展示「发现 N 组近似帧，建议删除 M 帧（每组保留首帧）」+ 每组 `保留 X，删 Y,Z` 标签）。
- 每组标签改为可点击：点击把该组的 `drop` 帧（建议删除帧）通过 store 的 `toggleFrameSelection` 加入帧条带多选（selection）；新增「全部加入选择」按钮，把所有组的 drop 帧一次性加入 selection。
- 加入后由用户在帧条带审视，使用 `preview-step.tsx` 已有的「删除选中 N 帧」自行删除——dedup-panel 自身不再触发删除。
- 移除 `DedupPanelProps.onDelete` 依赖（面板不再直接删帧）；`preview-step.tsx` 调用处同步去掉 `onDelete={handleDelete}` 传参。

**关键文件**：
- `spriteforge/components/step-preview/dedup-panel.tsx` — 去除批量删除，改为「加入多选」对接 selection
- `spriteforge/components/step-preview/preview-step.tsx` — 更新 `<DedupPanel />` 调用（去掉 onDelete 传参）
- `spriteforge/lib/store/workflow-store.ts` — 仅读取，复用现有 `selection` / `toggleFrameSelection` / `clearSelection`（无需改动，确认 API 即可）

**验收标准**：
- TypeScript 编译无错误、`npm run lint` 通过。
- 扫描后点某组 → 帧条带对应帧进入选中态；点「全部加入选择」→ 所有建议帧选中；用现有「删除选中」可删除；面板内已无任何直接删除按钮。
- 现有扫描/分组逻辑（`lib/frames/dedup.ts` + `workers/dedup.worker.ts` 行为）未被破坏。

**风险与限制**：
- 加入 selection 与帧条带已有多选状态可能叠加，需确认 `toggleFrameSelection` 的 toggle 语义不会把已选帧反选（必要时对 drop 帧用「仅添加」语义而非 toggle）。

---

## Phase 2: 循环检测算法层（共享 pHash + loop-detect worker）✅

**交付内容**：
- 抽出共享感知哈希工具 `lib/image/phash.ts`：导出 `dHash(blob): Promise<Uint8Array>`（9×8→64bit，逻辑等价于现有 `dedup.worker.ts` 内实现）与 `hamming(a,b): number`。
- 改造 `workers/dedup.worker.ts`：改为从 `lib/image/phash.ts` 导入 `dHash`/`hamming`，删除其内联实现，保持相邻去重对外行为与类型（`DedupRequest`/`DedupGroup`/`DedupResponse`）完全不变。
- 新增 `workers/loop-detect.worker.ts`：接收全部帧缩略图，复用 `dHash` 计算所有帧哈希；扫描**非相邻**循环闭合候选——对周期 `p`（从 `minPeriod` 到 `N−1`）计算重叠窗口内 `frame[i]` 与 `frame[i+p]` 的平均 Hamming 距离，低于阈值者作为候选，并以闭合点附近 K 帧窗口的平均距离做校验，过滤偶然撞脸的单帧相似。
- 新增 `lib/frames/loop-detect.ts`：`findLoopCandidates(frames, opts?)` 启动 loop-detect worker，返回候选数组 `{ start, end, period, distance }` 按 `distance` 升序（相似度从高到低），并定义类型 + 默认参数（`minPeriod`、阈值常量，参照现有 `DEFAULT_DEDUP_THRESHOLD = 6`）。

**关键文件**：
- `spriteforge/lib/image/phash.ts` — 新增，共享 dHash + hamming
- `spriteforge/workers/dedup.worker.ts` — 改用共享 phash（行为不变）
- `spriteforge/workers/loop-detect.worker.ts` — 新增，非相邻循环候选检测
- `spriteforge/lib/frames/loop-detect.ts` — 新增，worker 封装 + 候选类型 + 排序

**验收标准**：
- TypeScript 编译无错误、`npm run lint` 通过。
- 现有「扫描相邻近似帧」功能回归正常（dedup worker 改造未引入行为变化）。
- 临时冒烟：在第三步面板或 dev console 调用 `findLoopCandidates(frames)`，对一段含完整循环的素材能返回非空、按相似度排序的候选（验证后移除临时调用）。

**风险与限制**：
- 循环检测正确性是本迭代主要风险（误判周期 / 漏判），故先于 UI 单独成 Phase 验证；窗口校验的 K 与阈值可能需按实测素材微调。
- ESM module worker 导入共享模块需在 `{ type: "module" }` worker 下验证打包正常（Next 16 + Turbopack）。

---

## Phase 3: 循环检测 UI + 接 loopRange + 快捷删除 ✅

**交付内容**：
- 新增 `components/step-preview/loop-detect-panel.tsx`：「检测循环点」按钮 → 调 `findLoopCandidates` → 展示候选列表（按相似度排序，默认高亮最佳，显示周期/区间/相似度，类似 dedup-panel 的卡片风格）；含扫描中 loading、无候选提示、错误提示；复用 `framesSignature` 式的过期失效（增删/重排后旧候选作废）。
- 点选某候选 → 调用 store `setLoopRange({ start, end: Y−1 })` 写入循环区间（复用现有 `clampLoopRange` 钳制、`LoopMarker` 高亮与导出 loop 字段）。
- 选中候选后显示「删除区间外多余帧」快捷按钮：默认删除 `[0, X−1]`（前导）+ `[Y, N−1]`（尾段），仅保留 `[X, Y−1]` 一圈；点击走二次确认，确认后复用 `preview-step.tsx` 的 `handleDelete`（`deleteFrames` + `applyDeletion`）。用户也可不点、改用帧条带多选手动删。
- 在 `preview-step.tsx` 挂载 `<LoopDetectPanel />`（与 `<DedupPanel />` 同区，循环检测在前、近似帧在后）。

**关键文件**：
- `spriteforge/components/step-preview/loop-detect-panel.tsx` — 新增，循环检测面板 + 候选列表 + 快捷删除
- `spriteforge/components/step-preview/preview-step.tsx` — 挂载面板，复用 `handleDelete` 作为快捷删除入口
- `spriteforge/lib/frames/loop-detect.ts` — Phase 2 产出，被本面板消费
- `spriteforge/lib/store/workflow-store.ts` — 复用 `setLoopRange` / `previewIndex` / `selection`（确认 API，无需改动）

**验收标准**：
- TypeScript 编译无错误、`npm run lint` 通过。
- 端到端：第三步点「检测循环点」→ 出候选列表 → 点候选 → 循环区间高亮（动画预览/帧条带按区间循环，与手动 LoopMarker 一致）→ 点「删除区间外多余帧」二次确认后只剩一圈帧；不删时帧不变、区间仍生效。
- 导出 `spritesheet.json` 的 loop 字段反映检测设定的区间。
- 现有手动 `LoopMarker` 与近似帧扫描功能未被破坏。

**风险与限制**：
- 快捷删除后帧索引连续重排，需确认 `setLoopRange` 区间在删除后由 `clampLoopRange` 正确收敛（删完一圈后区间应覆盖整段或被清为「全段循环」）。

---

## Phase 依赖关系图

```
Phase 1（近似帧改造，独立）
Phase 2（循环检测算法）──→ Phase 3（循环检测 UI）
```

**并行可行性**：Phase 1 与 Phase 2 互不依赖，可并行（改的文件不重叠：Phase 1 动 dedup-panel/preview-step，Phase 2 动 phash/worker/loop-detect）。注意 Phase 1 与 Phase 3 都改 `preview-step.tsx`，串行或由主 Agent 合并。

**建议执行顺序**：单人 → Phase 1 → Phase 2 → Phase 3；双人 → A 做 Phase 1，B 做 Phase 2，B 完成后接 Phase 3（Phase 3 对 preview-step 的改动在 Phase 1 之后合并）。

---

## 技术栈

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 框架 | Next.js + React | 16.2.9 / 19.2.4 | 现有项目栈，无变更 |
| 语言 | TypeScript | 5.x | 现有 |
| 状态 | Zustand | 5.x | 复用 workflow-store 的 selection / loopRange |
| 计算 | Web Worker（module worker）| 浏览器原生 | 感知哈希在主线程外计算，复用现有 dedup worker 模式 |
| 存储 | IndexedDB（idb）| 8.x | 帧缩略图来源（getThumb），无变更 |

## 数据库变更（如有）

无（纯前端 + IndexedDB，无后端数据库变更）。

## 开发规则

- 每完成一个 Phase 执行四步走：Code Review → 测试完整性 → 编译验证 → 功能测试
- 四步走全部通过后才能进入待 commit 状态（commit 须用户显式授权）
- Commit message 格式：`phase-N [loop-detect-dedup]: 简要描述`
- 包管理器：npm

## 跨 plan 协作注意

- 本 plan 与 `mvp-workflow.md` 同改 `preview-step.tsx` / `dedup.worker.ts` / `workflow-store.ts`；mvp-workflow 第三步相关 Phase 已落地，本 plan 为其上的增量迭代，dev-builder 在 Plan Mode 会做关键文件交集检查，遇冲突由主 Agent 协调。
- 本 plan 无跨 plan 前置依赖（`depends_on: []`）。
