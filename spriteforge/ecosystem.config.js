// PM2 进程配置 — 生产环境用 `next start` 跑 SpriteForge。
// 用法（在 spriteforge/ 目录下）：
//   pm2 start ecosystem.config.js
//   pm2 save && pm2 startup    # 开机自启
//
// 说明：
// - 运行时环境变量（DB_*、AUTH_JWT_SECRET）由 Next.js 自动从 .env.local 读取，
//   不写在这里，避免密钥进 git。
// - NEXT_PUBLIC_AUTH_ENABLED 是构建期注入的，必须在 `next build` 之前就写进 .env.local。
module.exports = {
  apps: [
    {
      name: "spriteforge",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
    },
  ],
};
