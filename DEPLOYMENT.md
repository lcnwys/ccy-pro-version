# 创次元 PRO - PM2 生产环境部署教程

## 快速部署（推荐）

### 一键部署脚本（Linux）

```bash
# 1. 安装 Node.js、PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt update && sudo apt install -y nodejs
sudo npm install -g pm2

# 2. 克隆项目
sudo mkdir -p /var/www/ccy-pro-version
sudo chown $USER:$USER /var/www/ccy-pro-version
cd /var/www/ccy-pro-version
git clone https://github.com/lcnwys/ccy-pro-version.git .

# 3. 安装依赖
npm install -g pnpm
pnpm install
cd server && pnpm install && cd ..
cd client && pnpm install && cd ..

# 4. 配置环境变量
cp .env.example .env
nano .env  # 编辑配置

# 5. 构建前端
cd client
echo 'VITE_API_BASE_URL=/api/v1' > .env.production
pnpm build
cd ..

# 6. 构建后端
cd server
pnpm build
cd ..

# 7. 用 PM2 启动
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup  # 按提示执行生成的命令，设置开机自启

# 8. 配置 Nginx（可选，用于反向代理）
# 见下文 Nginx 配置部分
```

---

## 详细部署步骤

### 1. 安装基础环境

#### Ubuntu/Debian
```bash
# 更新软件包
sudo apt update && sudo apt upgrade -y

# 安装 Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 pnpm
sudo npm install -g pnpm

# 安装 PM2
sudo npm install -g pm2

# 验证安装
node -v && pnpm -v && pm2 -v
```

#### CentOS/RHEL
```bash
# 安装 Node.js 20.x
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# 安装 pnpm
sudo npm install -g pnpm

# 安装 PM2
sudo npm install -g pm2

# 验证安装
node -v && pnpm -v && pm2 -v
```

### 2. 克隆项目代码

```bash
# 创建部署目录
sudo mkdir -p /var/www/ccy-pro-version
sudo chown $USER:$USER /var/www/ccy-pro-version
cd /var/www/ccy-pro-version

# 克隆代码
git clone https://github.com/lcnwys/ccy-pro-version.git .
```

### 3. 安装依赖

```bash
# 安装 pnpm（如果没有）
npm install -g pnpm

# 根目录依赖（可选）
pnpm install

# Server 依赖
cd server
pnpm install

# Client 依赖
cd ../client
pnpm install
cd ..
```

### 4. 配置环境变量

```bash
# 创建生产环境配置
cp .env.example .env
nano .env
```

编辑 `.env` 文件：

```env
# 创次元 API Key (必填)
CHCYAI_API_KEY=your-api-key-here

# 服务配置
NODE_ENV=production
PORT=3000

# JWT 密钥 (生产环境务必修改)
JWT_SECRET=your-random-secret-key-change-this-in-production

# 数据库配置
DATABASE_PATH=./data/app.db

# 文件存储配置
STORAGE_PATH=./uploads

# 任务队列并发数
QUEUE_CONCURRENCY=3
```

### 5. 构建前端

```bash
cd /var/www/ccy-pro-version/client

# 配置生产 API 地址
echo 'VITE_API_BASE_URL=/api/v1' > .env.production

# 构建
pnpm build

# 构建产物输出到 dist/ 目录
cd ..
```

### 6. 构建后端

```bash
cd /var/www/ccy-pro-version/server

# 创建必要目录
mkdir -p data uploads

# 构建后端
pnpm build

cd ..
```

### 7. 配置 PM2

创建 `ecosystem.config.js` 文件：

```javascript
module.exports = {
  apps: [
    {
      name: 'ccy-pro-server',
      cwd: './server',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
    },
  ],
};
```

### 8. 使用 PM2 启动

```bash
cd /var/www/ccy-pro-version

# 启动应用
pm2 start ecosystem.config.js --env production

# 查看状态
pm2 status

# 查看日志
pm2 logs ccy-pro-server

# 保存 PM2 配置（开机自启）
pm2 save

# 配置开机自启
pm2 startup
# 按提示执行生成的命令，例如：
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u your-user --hp /home/your-user
```

---

## PM2 常用命令

### 服务管理
```bash
# 启动
pm2 start ecosystem.config.js --env production

# 停止
pm2 stop ccy-pro-server

# 重启
pm2 restart ccy-pro-server

# 查看状态
pm2 status

# 查看详细信息
pm2 show ccy-pro-server
```

### 日志管理
```bash
# 查看所有日志
pm2 logs

# 查看指定应用日志
pm2 logs ccy-pro-server

# 清空日志
pm2 flush

# 实时查看日志（带时间戳）
pm2 logs ccy-pro-server --time
```

### 高级操作
```bash
# 监控资源使用
pm2 monit

# 保存当前运行列表
pm2 save

# 删除应用
pm2 delete ccy-pro-server

# 重启所有应用
pm2 restart all

# 重载配置（无停机更新）
pm2 reload all
```

---

## Nginx 反向代理配置

### 1. 安装 Nginx

```bash
# Ubuntu/Debian
sudo apt install -y nginx

# CentOS/RHEL
sudo yum install -y nginx
```

### 2. 配置 Nginx

```bash
sudo nano /etc/nginx/sites-available/ccy-pro
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /var/www/ccy-pro-version/client/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 文件下载
    location /files/ {
        proxy_pass http://localhost:3000/files/;
        proxy_buffering off;
    }

    # 静态资源缓存
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        root /var/www/ccy-pro-version/client/dist;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 3. 启用配置

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/ccy-pro /etc/nginx/sites-enabled/

# 删除默认配置
sudo rm /etc/nginx/sites-enabled/default

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

---

## HTTPS 证书配置（Let's Encrypt）

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期测试
sudo certbot renew --dry-run
```

---

## 常见问题排查

### 1. PM2 启动失败

```bash
# 查看详细错误
pm2 logs ccy-pro-server --err

# 检查端口占用
sudo lsof -i :3000

# 检查目录权限
sudo chown -R $USER:$USER /var/www/ccy-pro-version
```

### 2. 数据库错误

```bash
cd /var/www/ccy-pro-version/server
rm -f data/app.db
pm2 restart ccy-pro-server
```

### 3. 文件上传失败

```bash
# 检查 uploads 目录权限
ls -la /var/www/ccy-pro-version/server/uploads

# 修改权限
chmod -R 755 /var/www/ccy-pro-version/server/uploads
```

### 4. PM2 开机自启失效

```bash
# 重新配置
pm2 startup
# 执行输出的命令
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp /home/$USER

# 保存当前应用列表
pm2 save
```

### 5. Nginx 502 Bad Gateway

```bash
# 检查 PM2 服务状态
pm2 status

# 如果服务未运行，重启
pm2 restart ccy-pro-server

# 检查 Nginx 日志
sudo tail -f /var/log/nginx/error.log
```

### 6. 更新代码后重启

```bash
cd /var/www/ccy-pro-version

# 拉取最新代码
git pull

# 重新安装依赖
pnpm install

# 重新构建
cd client && pnpm build && cd ..
cd server && pnpm build && cd ..

# 重启 PM2 服务
pm2 restart ccy-pro-server
```

---

## 监控与告警

### PM2 内置监控

```bash
# 实时监控面板
pm2 monit
```

### PM2 Plus（云端监控）

```bash
# 注册并链接
pm2 plus

# 按照提示完成注册和链接
```

### 自定义告警脚本

创建 `monitor.sh`:

```bash
#!/bin/bash

# 检查服务状态
STATUS=$(pm2 list | grep ccy-pro-server | awk '{print $6}')

if [ "$STATUS" != "online" ]; then
    echo "警告：ccy-pro-server 服务异常！" | mail -s "CCY-PRO 告警" admin@chcyai.com
    pm2 restart ccy-pro-server
fi
```

设置定时任务：

```bash
# 编辑 crontab
crontab -e

# 添加每 5 分钟检查一次
*/5 * * * * /var/www/ccy-pro-version/monitor.sh
```

---

## 备份策略

### 数据库备份

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backup/ccy-pro"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
cp /var/www/ccy-pro-version/server/data/app.db $BACKUP_DIR/app.db.$DATE

# 保留最近 7 天的备份
find $BACKUP_DIR -name "app.db.*" -mtime +7 -delete

echo "备份完成：$BACKUP_DIR/app.db.$DATE"
```

### Crontab 定时备份

```bash
# 每天凌晨 2 点备份
0 2 * * * /var/www/ccy-pro-version/backup.sh
```

---

## 性能优化

### 1. 多实例运行（可选）

修改 `ecosystem.config.js`:

```javascript
{
  name: 'ccy-pro-server',
  script: 'dist/index.js',
  instances: 'max',  // 根据 CPU 核心数自动调整
  exec_mode: 'cluster',
  // ...
}
```

**注意：** 由于使用 SQLite 数据库，多实例模式可能导致数据库锁定问题。如需多实例，建议改用 MySQL/PostgreSQL。

### 2. 增加文件描述符限制

```bash
# 编辑 /etc/security/limits.conf
echo "* soft nofile 65535" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65535" | sudo tee -a /etc/security/limits.conf

# 重启服务器生效
```

### 3. Nginx 缓存优化

```nginx
# 在 http 块中添加
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:100m max_size=1g inactive=7d;

# 在 location 块中使用
location /api/ {
    proxy_cache api_cache;
    proxy_cache_valid 200 10m;
    proxy_cache_valid 404 1m;
    # ...
}
```

---

## 默认管理员账号

首次启动后，使用以下账号登录：

- 邮箱：`admin@chcyai.com`
- 密码：`admin123`

**重要：** 首次登录后请立即修改默认密码！

---

## 快速参考卡片

```bash
# 查看服务状态
pm2 status

# 重启服务
pm2 restart ccy-pro-server

# 查看日志
pm2 logs --time

# 监控资源
pm2 monit

# 更新部署
cd /var/www/ccy-pro-version
git pull && pnpm install
cd client && pnpm build && cd ..
cd server && pnpm build && cd ..
pm2 restart ccy-pro-server

# 备份数据库
cp server/data/app.db backup/app.db.$(date +%Y%m%d)
```

---

## 技术支持

- GitHub: https://github.com/lcnwys/ccy-pro-version
- 邮箱：admin@chcyai.com
