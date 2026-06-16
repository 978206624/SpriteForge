# SpriteForge

> 网页端 2D 游戏角色序列帧生成工具：把视频转成透明 PNG 序列帧与 Sprite Sheet。
> **全程本地处理，视频不上传服务器。**

SpriteForge 用一条「导入 → 提取与抠图 → 预览与管理 → 导出」的四步骤工作流，把一段视频变成可直接喂给 Godot / Unity 等引擎的游戏素材。视频解码、抽帧、抠图、打包全部在浏览器里完成（Canvas + Web Workers + IndexedDB），服务端只负责登录与导出权限校验。

## 功能

- **第一步 · 导入与设置**：拖拽/选择本地视频（mp4 / mov / webm），读取分辨率/时长/帧率信息；时间轴选导出区间，选择帧率，实时预估帧数与大小。
- **第二步 · 提取与抠图**：按区间与帧率逐帧提取到 IndexedDB（刷新不丢）；逐帧色键抠图（容差 / 羽化 / 去边 + 画面取色），「应用到全部帧」批量处理，单帧可独立微调。
- **第三步 · 预览与管理**：按 fps 播放处理后帧（棋盘格透明背景、循环开关、调速）；多选删帧、相邻重复帧检测一键清理、标记循环区间。
- **第四步 · 导出**：PNG 序列 / Sprite Sheet（含 `spritesheet.json`）/ 完整 ZIP 资源包（`frames/` + `spritesheet/` + `config.json`）。Sprite Sheet 支持每行帧数、padding/margin、裁剪透明边界、统一帧尺寸，带拼图预览。
- **登录与试用**（可选）：接入 Clerk，游客可用前三步，导出触发登录；三天免费试用，过期显示升级提示（占位，未接支付）。

## 技术栈

Next.js 16（App Router + Turbopack）· React 19 · TypeScript · Tailwind CSS v4 · Zustand · Web Workers + Canvas/OffscreenCanvas · IndexedDB（idb）· JSZip · Clerk（可选）· pnpm。

## 本地运行

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

不配置任何环境变量即可运行：登录关闭，导出对所有人开放。

### 启用登录 + 三天试用（可选）

```bash
cp .env.example .env.local
```

在 [Clerk Dashboard](https://dashboard.clerk.com) 拿到密钥后，**三个变量必须一起配置**：

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_AUTH_ENABLED` | 设为 `true` 打开登录/导出闸门（客户端可见开关） |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk 公钥（客户端） |
| `CLERK_SECRET_KEY` | Clerk 私钥（仅服务端，切勿暴露） |

> 只配置部分变量会降级：客户端开关未开 → 全开放；仅公钥 → 服务端不强制（前端仍可登录但试用不强制）。生产务必三者齐配。

## 构建与部署

```bash
pnpm build && pnpm start
```

推荐部署到 **Vercel**（Next.js 零运维）：导入仓库，在 Project Settings → Environment Variables 配置上面三个变量即可。`proxy.ts`（Next 16 的中间件，旧称 middleware）会自动接入 Clerk。无密钥也能成功构建与部署（开放模式）。

## 隐私

任何阶段都不上传用户视频或帧：解码、抽帧、抠图、查重、打包均在浏览器本地完成，帧位图存于浏览器 IndexedDB。服务端 API 仅校验登录与试用状态，不接收任何媒体数据。

## Roadmap

- WebCodecs 高性能抽帧、ffmpeg.wasm 支持 mkv 等更多格式
- AI 自动抠图、AI 补间插帧
- 自动裁剪透明边界 / 脚底锚点对齐
- 批量处理、动作分段
- Godot AnimatedSprite2D / Unity Sprite Metadata 专用导出
- GIF / APNG 导出
- 真实付费会员、项目云保存、团队协作
