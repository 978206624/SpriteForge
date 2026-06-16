-- SpriteForge 自托管 MySQL schema
-- 仅在开启登录闸门（NEXT_PUBLIC_AUTH_ENABLED=true）时需要。
-- 在服务器上执行：
--   mysql -u root -p < db/schema.sql
-- 或先建库再导入：
--   CREATE DATABASE IF NOT EXISTS spriteforge CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS spriteforge
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE spriteforge;

-- 用户表：邮箱 + bcrypt 密码哈希 + 3 天试用起始时间
-- trial_started_at 存 epoch 毫秒（Date.now()，约 1.7e12），超出 INT 范围，必须 BIGINT
CREATE TABLE IF NOT EXISTS users (
  id               INT UNSIGNED   NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email            VARCHAR(255)   NOT NULL,
  password_hash    VARCHAR(255)   NOT NULL,
  trial_started_at BIGINT         NULL,
  created_at       TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
