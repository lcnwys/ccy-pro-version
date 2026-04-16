# 创次元 PRO - 安装和启动指南

## 重要说明

由于 `better-sqlite3` 在 Windows 上需要编译原生模块，已替换为 `sql.js`（纯 JavaScript 实现，无需编译）。

## 快速启动

### 方法一：使用批处理脚本（推荐）

1. **双击运行** `start.bat`

首次运行会自动安装所有依赖，之后会直接启动服务。

### 方法二：手动安装和启动

```bash
# 1. 进入项目目录
cd D:/claude-program/ccy-pro-version

# 2. 安装 server 依赖
cd server
npm install

# 3. 安装 client 依赖
cd ../client
npm install

# 4. 返回根目录并启动
cd ..
npm run dev
```

### 方法三：分别启动（推荐用于开发）

```bash
# Terminal 1 - 启动后端
cd D:/claude-program/ccy-pro-version/server
npm install  # 首次运行
npm run dev

# Terminal 2 - 启动前端
cd D:/claude-program/ccy-pro-version/client
npm install  # 首次运行
npm run dev
```

## 访问地址

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端 | http://localhost:5173 | React 应用 |
| 后端 API | http://localhost:3000 | Express 服务 |
| 健康检查 | http://localhost:3000/health | API 状态 |
| 功能列表 | http://localhost:3000/api/v1/functions | 所有可用功能 |

## 环境变量

已在 `.env` 文件中配置：

```env
CHCYAI_API_KEY=sk-4DZU20k6iSV85-CgwGm9c6Mb
NODE_ENV=development
PORT=3000
DATABASE_PATH=./data/app.db
STORAGE_PATH=./server/uploads
QUEUE_CONCURRENCY=3
```

## 依赖说明

### Server 依赖
- `express` - Web 框架
- `cors` - CORS 中间件
- `multer` - 文件上传
- `sql.js` - SQLite 数据库（无需编译）
- `axios` - HTTP 客户端
- `uuid` - UUID 生成
- `dotenv` - 环境变量

### Client 依赖
- `react` - UI 框架
- `react-router-dom` - 路由
- `zustand` - 状态管理
- `axios` - API 客户端
- `tailwindcss` - CSS 框架

## 生产部署

```bash
# 1. 构建前端
cd client
npm run build

# 2. 构建后端
cd ../server
npm run build

# 3. 设置生产环境变量
# 编辑 .env: NODE_ENV=production

# 4. 启动生产服务
npm start
```

生产模式下，后端会自动 serve 前端构建产物，无需单独运行前端。

## 常见问题

### Q: npm install 失败
A: 尝试以下命令：
```bash
npm cache clean --force
npm install --force
```

### Q: 端口被占用
A: 修改 `.env` 中的 `PORT=3000` 为其他端口

### Q: 数据库错误
A: 删除 `data/app.db` 文件后重启服务

### Q: 文件上传失败
A: 确保 `server/uploads` 目录存在

## 项目结构

```
ccy-pro-version/
├── server/
│   ├── src/
│   │   ├── controllers/      # 控制器
│   │   ├── services/         # 业务逻辑
│   │   ├── routes/           # API 路由
│   │   ├── database/         # 数据库 (sql.js)
│   │   └── queue/            # 任务队列
│   └── uploads/              # 上传文件
├── client/
│   └── src/
│       ├── components/       # 组件
│       ├── pages/            # 页面
│       ├── api/              # API 客户端
│       └── stores/           # 状态管理
├── data/                     # SQLite 数据库
├── .env                      # 环境变量
└── start.bat                 # 启动脚本
```

## 技术支持

如有问题，请查看：
1. README.md - 完整开发指南
2. .env.example - 环境变量示例
3. 日志输出 - 查看错误信息
