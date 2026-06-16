# SpriteForge 部署手册（自托管服务器 · PM2 · pnpm）

面向 Linux 服务器、用 PM2 跑 `next start`、开启登录闸门、先用 `IP:端口` 访问。
**应用与 MySQL 同机部署**（数据库就是 `111.229.210.98` 这台）。

> ✅ **字体已本地化**：`app/layout.tsx` 改用 `next/font/local`（woff2 在 `app/fonts/`），
> `pnpm build` 不再访问 Google Fonts，国内服务器构建不会卡字体。
>
> ℹ️ **包管理器是 pnpm**（仓库有 pnpm-lock.yaml），别用 npm 安装，否则报错。

---

## 0. 服务器前置（一次性）

```bash
# Node 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# pnpm + PM2
sudo npm install -g pnpm pm2

# MySQL 已在本机运行（就是现在 111.229.210.98 这台），无需重装。
```

## 1. 拉代码 + 装依赖

```bash
git clone <你的-GitHub-仓库地址> spriteforge-app
cd spriteforge-app/spriteforge        # 代码在子目录 spriteforge/
pnpm install                          # 用 pnpm，不是 npm
```

## 2. 数据库（同机，库表已存在）

你本地开发一直在写这台库，`spriteforge` 库和 `users` 表**已经建好**，正常情况无需任何操作。

- 如需确认表在：`mysql -u root -p -e "USE spriteforge; SHOW TABLES; DESCRIBE users;"`
- 全新库才需要建表（幂等，不会清数据）：`mysql -u root -p < db/schema.sql`

**安全加固（强烈建议）：**

```bash
# 1) 建最小权限应用账号，别让线上用 root
sudo mysql -u root -p -e "
  CREATE USER IF NOT EXISTS 'sf_app'@'localhost' IDENTIFIED BY '换成强密码';
  GRANT SELECT, INSERT, UPDATE, DELETE ON spriteforge.* TO 'sf_app'@'localhost';
  FLUSH PRIVILEGES;"
```

```ini
# 2) 把 MySQL 绑定到本机，关掉公网监听（编辑 /etc/mysql/mysql.conf.d/mysqld.cnf）
bind-address = 127.0.0.1
# 改完 sudo systemctl restart mysql；再到云安全组关掉 3306 的公网放行。
```

> ⚠️ **锁本机后，你本地电脑就连不上这台库了**（本地走公网）。两种处理：
> - 本地开发改连一个本机/测试 MySQL（推荐，线上数据和开发数据分开）；
> - 或保留一条「仅你办公 IP」的安全组规则给 3306，本地继续直连（数据共用，注意是生产数据）。

## 3. 配置环境变量 `.env.local`

在服务器的 `spriteforge/` 下新建 `.env.local`（**已 gitignore，切勿提交**）。
因为应用和库同机，`DB_HOST` 用 `127.0.0.1` 本机直连：

```dotenv
NEXT_PUBLIC_AUTH_ENABLED=true        # 构建期注入，必须在 pnpm build 之前写好

DB_HOST=127.0.0.1                    # 同机本地直连，不绕公网
DB_PORT=3306
DB_USER=sf_app                       # 用上面建的最小权限账号（或暂用 root）
DB_PASSWORD=和上面一致的强密码
DB_NAME=spriteforge

# 会话 JWT 密钥：沿用你现在的，或重置。重置会让现有登录态全部失效。
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
AUTH_JWT_SECRET=粘贴随机串
```

## 4. 构建

```bash
pnpm build      # 本地字体，不依赖外网；零错误即成功
```

## 5. 用 PM2 启动

```bash
pm2 start ecosystem.config.js
pm2 save                       # 保存进程列表
pm2 startup                    # 按提示执行输出的命令，设开机自启
pm2 logs spriteforge           # 看日志确认连库成功、无报错
```

## 6. 放行端口 / 访问

- 云安全组：放行 TCP **3000**（应用端口）；同时**关掉 3306 的公网**放行。
- 本机防火墙：`sudo ufw allow 3000/tcp`
- 浏览器访问 `http://111.229.210.98:3000` 验证；注册/登录/导出走一遍确认连库正常。

---

## 更新重新部署

```bash
cd spriteforge-app && git pull
cd spriteforge && pnpm install && pnpm build
pm2 reload spriteforge         # 平滑重启
```

## 加域名 / HTTPS（以后需要时）

Nginx 反代到 `127.0.0.1:3000` + certbot 申请 Let's Encrypt 证书。需要时我给你配。

## 安全底线

- `.env.local` 永不进 git（已在 .gitignore）。
- 线上用最小权限 `sf_app`，不用 root；MySQL 绑 127.0.0.1，3306 不开公网。
- `AUTH_JWT_SECRET` 用足够长随机串，泄露会导致会话可伪造。
