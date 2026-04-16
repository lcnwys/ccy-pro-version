# 创次元 PRO 系统设计文档

## 1. 产品概述

### 1.1 产品名称
**创次元 PRO** - 跨境电商 AI 图片处理平台

### 1.2 产品定位
面向跨境电商卖家和产品设计从业者的 SaaS 平台，提供批量化的 AI 图片处理服务。

### 1.3 核心价值
- **批量处理**: 支持多张图片同时处理，解决原平台只能单图处理的痛点
- **功能聚合**: 集成 12 种 AI 图片处理功能，一站式解决所有需求
- **专业高效**: 专业工具风格界面，为电商卖家打造高效工作台

### 1.4 目标用户
- 跨境电商卖家（亚马逊、Temu、Shein、Shopee 等平台）
- 产品设计师
- 电商摄影工作室

---

## 2. 技术架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户浏览器                                │
│                    React + TypeScript                           │
│                  ui-ux-pro-max 专业工具风格                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     前端静态资源 (CDN)                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Node.js 后端服务                              │
│  ┌─────────────┬─────────────┬─────────────┬─────────────────┐  │
│  │  API Gateway │  任务队列   │  文件服务   │   计费统计      │  │
│  │  (Express)   │  (Bull)     │  (Multer)   │   (SQLite)      │  │
│  └─────────────┴─────────────┴─────────────┴─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  创次元 AI 开放平台 API                            │
│              https://api.chcyai.com                             │
│         (Bearer Token 鉴权，平台统一管理 API Key)                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 技术栈

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| 前端 | React 18 + TypeScript | 类型安全，组件化开发 |
| UI 框架 | ui-ux-pro-max | 专业工具风格设计系统 |
| 状态管理 | Zustand | 轻量级状态管理 |
| 后端 | Node.js 20 + Express | 高性能 I/O 处理 |
| 数据库 | SQLite (开发) / PostgreSQL (生产) | 轻量到生产无缝切换 |
| 任务队列 | Bull + Redis | 异步任务处理 |
| 文件存储 | 本地存储 (开发) / 云存储 (生产) | 灵活部署 |
| API 调用 | Axios | HTTP 客户端 |

---

## 3. 功能模块设计

### 3.1 模块总览

```
创次元 PRO
├── 用户系统
│   ├── API Key 配置
│   ├── 用量统计
│   └── 账户设置
├── 单图处理
│   ├── 12 种 AI 功能
│   └── 实时预览
├── 批量处理
│   ├── 多图上传
│   ├── 队列管理
│   ├── 进度追踪
│   └── 批量下载
├── 任务管理
│   ├── 任务历史
│   ├── 状态查询
│   └── 结果管理
└── 系统设置
    ├── 功能配置
    └── 帮助文档
```

### 3.2 API 功能映射

基于原平台 API，封装以下 12 种功能：

| 功能编号 | 功能名称 | API 路径 | 核心参数 |
|----------|----------|----------|----------|
| F01 | AI 生图 | `/v1/images/generations` | prompt, aspectRatioId, resolutionRatioId |
| F02 | 打印图生成 | `/v1/prints/generations` | dpi, selectedArea, imageHeight, imageWidth |
| F03 | 印花提取 | `/v1/pattern-extraction/generations` | isPatternCompleted, resolutionRatioId |
| F04 | 图裂变 | `/v1/fission/generations` | similarity, aspectRatioId, resolutionRatioId |
| F05 | AI 变清晰 | `/v1/becomes-clear/generations` | referenceImageId |
| F06 | 服装上身 | `/v1/clothing-upper/generations` | tops/bottomsImageId, aspectRatioId |
| F07 | 服装去皱 | `/v1/clothing-wrinkle-removal/generations` | aspectRatioId, resolutionRatioId |
| F08 | 扣头像 | `/v1/cut-out-portrait/generations` | referenceImageId |
| F09 | 3D 服装图 | `/v1/clothing-diagram/generations` | aspectRatioId, resolutionRatioId |
| F10 | 服装提取 | `/v1/garment-extractions/generations` | backgroundId, aspectRatioId |
| F11 | 智能抠图 | `/v1/intelligent-matting/generations` | smooth, referenceImageId |
| F12 | 文件上传 | `/v1/files/uploads` | file (multipart) |

### 3.3 批量处理设计

**核心流程**:

```
1. 用户选择功能 → 2. 上传多张图片 → 3. 配置参数 → 4. 提交任务队列
                                              ↓
5. 批量下载 ← 4.1 轮询状态 ← 3. 并发处理 (可配置) ← 2. 生成子任务
```

**队列配置**:
- 默认并发数：3（可配置 1-10）
- 失败重试：2 次
- 超时时间：300 秒/任务

**进度追踪**:
- 总进度：已完成/总数
- 单个任务状态：等待中/处理中/成功/失败
- 实时刷新：WebSocket 或 轮询（5 秒间隔）

---

## 4. 数据库设计

### 4.1 用户表 (users)

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255),
    api_key_encrypted TEXT NOT NULL,  -- 加密存储
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 4.2 任务表 (tasks)

```sql
CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    batch_id VARCHAR(100) NOT NULL,  -- 批次 ID，用于批量任务分组
    function_type VARCHAR(50) NOT NULL,  -- F01-F12
    status VARCHAR(20) DEFAULT 'pending',  -- pending/processing/success/failed
    input_data TEXT NOT NULL,  -- JSON: 输入参数
    output_data TEXT,  -- JSON: 输出结果
    task_id_origin VARCHAR(100),  -- 原平台返回的 taskId
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 4.3 使用统计表 (usage_stats)

```sql
CREATE TABLE usage_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    function_type VARCHAR(50) NOT NULL,
    count INTEGER DEFAULT 0,
    last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, function_type),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 5. API 接口设计（后端）

### 5.1 用户接口

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 获取用户信息 | GET | `/api/v1/user` | 当前用户信息 |
| 更新 API Key | PUT | `/api/v1/user/api-key` | 配置 API Key |
| 获取用量统计 | GET | `/api/v1/user/usage` | 各功能使用统计 |

### 5.2 任务接口

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 创建单图任务 | POST | `/api/v1/tasks/single` | 单图处理 |
| 创建批量任务 | POST | `/api/v1/tasks/batch` | 批量处理 |
| 获取任务列表 | GET | `/api/v1/tasks` | 任务历史 |
| 获取任务详情 | GET | `/api/v1/tasks/:id` | 任务详情 |
| 获取任务进度 | GET | `/api/v1/tasks/:id/progress` | 批量任务进度 |
| 下载结果 | GET | `/api/v1/tasks/:id/download` | 下载处理结果 |
| 删除任务 | DELETE | `/api/v1/tasks/:id` | 删除任务 |

### 5.3 功能配置接口

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 获取功能列表 | GET | `/api/v1/functions` | 所有可用功能 |
| 获取功能参数 | GET | `/api/v1/functions/:type` | 特定功能参数配置 |

---

## 6. 前端页面设计

### 6.1 页面结构

```
创次元 PRO
├── 登录页 /login
├── 仪表盘 /dashboard
│   └── 快速入口、最近任务、用量概览
├── 功能选择 /functions
│   └── 12 种功能卡片
├── 单图处理 /function/:type/single
│   └── 图片上传、参数配置、预览、提交
├── 批量处理 /function/:type/batch
│   └── 多图上传、队列预览、进度追踪、批量下载
├── 任务中心 /tasks
│   └── 任务列表、筛选、详情、下载
└── 设置 /settings
    └── API Key 配置、用量统计、帮助文档
```

### 6.2 设计风格（专业工具风）

**色彩系统**:
- 主色：深蓝 (#1a365d) - 专业、可靠
- 强调色：科技蓝 (#3182ce) - 操作、交互
- 成功色：绿色 (#38a169)
- 警告色：橙色 (#dd6b20)
- 错误色：红色 (#e53e3e)

**排版**:
- 标题：系统字体，字重 600-700
- 正文：系统字体，字重 400
- 代码/参数：等宽字体

**组件风格**:
- 卡片：轻微阴影，圆角 4px
- 按钮：实心主色，hover 有反馈
- 表格：紧凑布局，斑马纹
- 进度条：分段显示，清晰状态

---

## 7. 安全设计

### 7.1 API Key 安全
- 后端加密存储（AES-256）
- 不在日志中输出完整 Key
- 前端仅显示掩码（如：`sk_****...abcd`）

### 7.2 数据传输
- 全站 HTTPS
- 敏感数据加密传输
- 文件上传校验（类型、大小 ≤ 5MB）

### 7.3 访问控制
- JWT Token 认证
- Token 过期时间：24 小时
- 刷新 Token 机制

---

## 8. 部署设计（部署友好型）

### 8.1 设计原则：Local = Production

**核心思想**：开发和生产使用相同的架构和配置，避免环境差异导致的部署问题。

**关键措施**：
1. **前端**：开发时直接代理到后端，避免 CORS
2. **后端**：统一配置管理，环境自动检测
3. **数据库**：SQLite 作为默认，生产也可用（轻量部署），可选 PostgreSQL
4. **任务队列**：使用内存队列（开发）→ Redis（生产），接口一致

---

### 8.2 推荐架构：单体部署（Monolith）

```
┌─────────────────────────────────────────────────────┐
│              Nginx (生产) / 前端内置服务器 (开发)     │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │            React 前端 (SPA)                  │    │
│  │  - 构建产物由后端 serve                       │    │
│  │  - 开发时通过 Vite 代理到后端                 │    │
│  └─────────────────────────────────────────────┘    │
│                        │                             │
│                        ▼                             │
│  ┌─────────────────────────────────────────────┐    │
│  │         Node.js 后端 (Express)               │    │
│  │  - API 路由                                  │    │
│  │  - 静态文件服务                              │    │
│  │  - 任务队列处理                              │    │
│  └─────────────────────────────────────────────┘    │
│                        │                             │
│                        ▼                             │
│  ┌─────────────────────────────────────────────┐    │
│  │         SQLite 数据库 (文件)                  │    │
│  │  - 无需额外服务                              │    │
│  │  - 生产环境可直接使用                        │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**优势**：
- ✅ 无 CORS 问题：前后端同域
- ✅ 部署简单：只需运行一个 Node.js 进程
- ✅ 配置统一：一套配置文件
- ✅ 调试方便：所有日志在一个地方

---

### 8.3 开发环境配置

**前端 Vite 代理配置** (`vite.config.ts`)：
```typescript
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
```

**后端 CORS 配置**（仅开发环境启用）：
```typescript
import cors from 'cors';

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:5173'],
  credentials: true
}));
```

**开发启动脚本** (`package.json`)：
```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    "dev:backend": "tsx watch server/src/index.ts",
    "dev:frontend": "vite",
    "build": "vite build",
    "start": "node server/dist/index.js"
  }
}
```

---

### 8.4 生产环境部署

**方案 A：单机部署（推荐 MVP 阶段）**
```bash
# 1. 构建
npm run build

# 2. 启动（前端构建产物由后端 serve）
NODE_ENV=production node server/dist/index.js
```

**Nginx 配置**（可选，如果需要 HTTPS 或反向代理）：
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**方案 B：Docker 部署（推荐生产阶段）**
```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
COPY server ./server
COPY client ./client

RUN npm ci --production
RUN npm run build

EXPOSE 3000
CMD ["node", "server/dist/index.js"]
```

**docker-compose.yml**：
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_PATH=/data/app.db
    volumes:
      - ./data:/data
      - ./uploads:/app/uploads
    restart: unless-stopped
```

---

### 8.5 统一配置管理

**配置文件结构**：
```
config/
├── default.ts    # 默认配置
├── development.ts # 开发环境覆盖
└── production.ts  # 生产环境覆盖
```

**配置示例** (`config/default.ts`)：
```typescript
export default {
  // 服务配置
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0'
  },
  
  // 数据库（SQLite 作为默认，无需额外服务）
  database: {
    type: 'sqlite',
    path: process.env.DATABASE_PATH || './data/app.db'
  },
  
  // 文件存储
  storage: {
    path: process.env.STORAGE_PATH || './uploads',
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp']
  },
  
  // 任务队列（开发用内存，生产用 Redis）
  queue: {
    type: process.env.REDIS_HOST ? 'redis' : 'memory',
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379')
    },
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '3')
  },
  
  // API 配置
  chcyai: {
    baseUrl: 'https://api.chcyai.com',
    apiKey: process.env.CHCYAI_API_KEY,
    timeout: 300000 // 5 分钟
  },
  
  // CORS（生产环境禁用，因为前后端同域）
  cors: {
    enabled: process.env.NODE_ENV !== 'production',
    origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173']
  }
};
```

---

### 8.6 环境变量清单

```env
# ===== 必需配置 =====
CHCYAI_API_KEY=your-api-key-here

# ===== 可选配置（有默认值）=====
NODE_ENV=production          # 运行环境
PORT=3000                    # 服务端口
DATABASE_PATH=./data/app.db  # 数据库路径

# ===== 进阶配置（按需）=====
REDIS_HOST=                  # Redis 主机（空则使用内存队列）
REDIS_PORT=6379              # Redis 端口
QUEUE_CONCURRENCY=3          # 任务并发数
STORAGE_PATH=./uploads       # 文件存储路径
CORS_ORIGINS=http://localhost:5173  # CORS 白名单
```

---

### 8.7 部署检查清单

**部署前检查**：
- [ ] 环境变量已正确配置
- [ ] API Key 已设置
- [ ] 数据库目录有写入权限
- [ ] 文件存储目录有写入权限
- [ ] 防火墙开放对应端口

**部署后验证**：
- [ ] 前端页面可访问
- [ ] API 接口可调用（无 CORS 错误）
- [ ] 文件上传功能正常
- [ ] 任务队列正常工作
- [ ] 数据库读写正常

---

### 8.8 常见问题规避

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| CORS 错误 | 前后端不同域 | 开发用 Vite 代理，生产同域部署 |
| 路径错误 | __dirname 在 ESM 中不可用 | 使用 fileURLToPath 转换 |
| 数据库锁死 | SQLite 并发写入 | 使用 WAL 模式，或切换到 PostgreSQL |
| 内存队列丢失 | 进程重启 | 生产环境使用 Redis |
| 文件找不到 | 静态资源路径错误 | 统一使用 path.join，禁用 path.resolve |
| 环境变量不生效 | .env 文件未加载 | 使用 dotenv，检查路径 |

---

## 9. 开发计划

### Phase 1 - MVP（2-3 周）
- [ ] 项目脚手架搭建
- [ ] 后端基础框架（Express + 数据库）
- [ ] 文件上传/下载接口
- [ ] 12 种功能 API 封装
- [ ] 任务队列系统
- [ ] 前端基础框架
- [ ] 单图处理界面
- [ ] 批量处理界面
- [ ] 任务管理界面

### Phase 2 - 增强（1-2 周）
- [ ] 用户认证系统
- [ ] 用量统计
- [ ] WebSocket 实时进度
- [ ] 批量下载（打包 ZIP）

### Phase 3 - 进阶（规划）
- [ ] 工作流编排功能
- [ ] 更详细的计费统计
- [ ] 团队协作功能

---

## 10. 风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| 原平台 API 不稳定 | 任务失败 | 重试机制、降级处理 |
| 大批量任务超时 | 用户体验差 | 分批次处理、进度反馈 |
| 文件存储膨胀 | 成本增加 | 定期清理、临时 URL 机制 |
| 并发过高 | 服务压力大 | 限流、队列控制 |

---

## 11. 成功指标

- 支持单次批量处理 ≥ 50 张图片
- 任务成功率 ≥ 95%
- 平均响应时间 < 2 秒
- 用户界面操作流畅度 ≥ 60fps
