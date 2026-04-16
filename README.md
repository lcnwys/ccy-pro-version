# 创次元 PRO 开发指南

## 快速启动

### 方法一：使用启动脚本（推荐）

双击运行 `start.bat` 即可自动安装依赖并启动前后端服务。

### 方法二：手动启动

```bash
# 1. 安装依赖
cd D:/claude-program/ccy-pro-version

# 根目录
npm install

# Server
cd server
npm install

# Client
cd ../client
npm install

# 2. 启动开发服务器
# 方式 A：同时启动前后端（推荐）
cd ..
npm run dev

# 方式 B：分别启动
# Terminal 1 - Server
cd server
npm run dev

# Terminal 2 - Client
cd client
npm run dev
```

## 访问地址

- 前端：http://localhost:5173
- 后端 API: http://localhost:3000
- API 文档：http://localhost:3000/api/v1/functions

## 环境变量

已配置在 `.env` 文件中：

```env
CHCYAI_API_KEY=sk-4DZU20k6iSV85-CgwGm9c6Mb
NODE_ENV=development
PORT=3000
DATABASE_PATH=./data/app.db
STORAGE_PATH=./server/uploads
QUEUE_CONCURRENCY=3
```

## 生产部署

```bash
# 1. 构建
npm run build

# 2. 启动（生产模式）
cd server
npm start
```

生产模式下，后端会自动 serve 前端构建产物，无需单独运行前端。

## 项目结构

```
ccy-pro-version/
├── server/           # 后端服务
│   ├── src/
│   │   ├── controllers/   # 控制器
│   │   ├── services/      # 业务逻辑
│   │   ├── routes/        # API 路由
│   │   ├── database/      # 数据库
│   │   └── queue/         # 任务队列
│   └── uploads/           # 上传文件存储
│
├── client/           # 前端应用
│   └── src/
│       ├── components/    # 组件
│       ├── pages/         # 页面
│       ├── api/           # API 客户端
│       └── stores/        # 状态管理
│
├── data/             # SQLite 数据库
├── .env              # 环境变量
└── start.bat         # 启动脚本
```

## 功能列表

| 功能 | API 路径 | 说明 |
|------|----------|------|
| AI 生图 | /v1/images/generations | 根据提示词生成图片 |
| 打印图生成 | /v1/prints/generations | 生成可打印的高分辨率图片 |
| 印花提取 | /v1/pattern-extraction/generations | 从图片中提取印花图案 |
| 图裂变 | /v1/fission/generations | 基于原图生成多个变体 |
| AI 变清晰 | /v1/becomes-clear/generations | AI 增强图片清晰度 |
| 服装上身 | /v1/clothing-upper/generations | 虚拟试衣 |
| 服装去皱 | /v1/clothing-wrinkle-removal/generations | 去除服装褶皱 |
| 扣头像 | /v1/cut-out-portrait/generations | 智能抠取人像 |
| 3D 服装图 | /v1/clothing-diagram/generations | 生成 3D 服装展示图 |
| 服装提取 | /v1/garment-extractions/generations | 提取服装主体 |
| 智能抠图 | /v1/intelligent-matting/generations | 智能抠图 |

## 常见问题

### CORS 错误
开发环境已配置代理，不会出现 CORS 问题。如遇 CORS 错误，请检查：
1. 后端是否正常启动（http://localhost:3000/health 应返回 ok）
2. 前端 vite.config.ts 中的 proxy 配置是否正确

### 数据库错误
如遇数据库错误，删除 `data/app.db` 文件后重启服务即可。

### 文件上传失败
检查 `server/uploads` 目录是否存在且有写入权限。

## 技术支持

如有问题，请联系开发团队。
