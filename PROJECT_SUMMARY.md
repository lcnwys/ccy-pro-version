# 创次元 PRO - 系统架构与实现总结

> 文档生成时间：2026-04-15  
> 版本：v1.0.0

---

## 一、系统概述

创次元 PRO 是一个面向跨境电商的 AI 图像处理 SaaS 平台，提供 12 种 AI 图片处理功能，采用多租户架构，支持团队管理和额度分配。

### 核心特性

- **团队注册制**：注册即创建团队，自动成为团队管理员
- **管理员创建成员**：团队管理员可在平台内直接创建员工账号
- **多租户隔离**：团队间数据、额度、API Key 完全隔离
- **额度管理**：平台→团队→成员的三级额度分配体系
- **角色权限**：平台超级管理员、团队管理员、普通成员
- **团队 API Key**：每个团队配置一个 API Key，团队成员共享使用

---

## 二、系统架构

### 2.1 技术栈

| 层级 | 技术选型 |
|------|----------|
| 前端 | React 18 + TypeScript + Vite 5 + TailwindCSS |
| 后端 | Node.js + Express + TypeScript (ES Modules) |
| 数据库 | SQLite (sql.js) |
| 认证 | JWT (7 天有效期) |
| 密码加密 | bcryptjs |
| 文件上传 | multer |

### 2.2 目录结构

```
ccy-pro-version/
├── client/                 # 前端
│   ├── src/
│   │   ├── components/     # 可复用组件
│   │   ├── contexts/       # React Context (AuthContext)
│   │   ├── pages/          # 页面组件
│   │   ├── api/            # API 客户端
│   │   └── App.tsx         # 路由配置
│   └── package.json
│
├── server/                 # 后端
│   ├── src/
│   │   ├── config/         # 配置文件
│   │   ├── controllers/    # 控制器层
│   │   ├── database/       # 数据库初始化
│   │   ├── middlewares/    # 中间件 (auth)
│   │   ├── routes/         # API 路由
│   │   ├── services/       # 业务逻辑层
│   │   │   ├── authService.ts      # 认证服务
│   │   │   ├── teamService.ts      # 团队服务
│   │   │   ├── budgetService.ts    # 预算服务
│   │   │   ├── platformService.ts  # 平台服务
│   │   │   └── chcyaiService.ts    # 创次元 API 客户端
│   │   ├── queue/          # 任务队列
│   │   └── index.ts        # 服务器入口
│   └── package.json
│
└── package.json            # 根配置 (concurrently)
```

---

## 三、数据库设计

### 3.1 ER 图

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   users     │     │    teams     │     │ team_members│
├─────────────┤     ├──────────────┤     ├─────────────┤
│ id          │────<│ id           │>────│ team_id     │
│ email       │     │ name         │     │ user_id     │
│ password    │     │ owner_id     │     │ role        │
│ nickname    │     │ api_key      │     │ joined_at   │
│ role        │     │ created_at   │     └─────────────┘
│ team_id     │     └──────────────┘
│ is_team_adm │
└─────────────┘
       │
       │ 1:N
       ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│budget_alloc │     │   budgets    │     │ transactions│
├─────────────┤     ├──────────────┤     ├─────────────┤
│ id          │     │ id           │     │ id          │
│ team_id     │     │ team_id      │     │ type        │
│ user_id     │     │ amount       │     │ amount      │
│ amount      │     │ used_amount  │     │ team_id     │
│ used_amount │     │ created_by   │     │ user_id     │
└─────────────┘     └──────────────┘     │ task_id     │
                                          └─────────────┘
```

### 3.2 核心表结构

#### users (用户表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| email | TEXT | 邮箱 (唯一) |
| password_hash | TEXT | 密码哈希 |
| nickname | TEXT | 昵称 |
| role | TEXT | `super_admin` / `member` |
| team_id | INTEGER | 所属团队 ID (外键) |
| is_team_admin | BOOLEAN | 是否团队管理员 |

#### teams (团队表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| name | TEXT | 团队名称 |
| description | TEXT | 描述 |
| owner_id | INTEGER | 创建者 ID (外键) |
| api_key | TEXT | 团队 API Key |

#### team_members (团队成员表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| team_id | INTEGER | 团队 ID |
| user_id | INTEGER | 用户 ID |
| role | TEXT | `admin` / `member` |
| joined_at | DATETIME | 加入时间 |

#### budgets (团队预算表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| team_id | INTEGER | 团队 ID |
| amount | INTEGER | 总额度 |
| used_amount | INTEGER | 已用额度 |
| created_by | INTEGER | 创建者 ID |

#### budget_allocations (额度分配表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| team_id | INTEGER | 团队 ID |
| user_id | INTEGER | 用户 ID |
| amount | INTEGER | 分配额度 |
| used_amount | INTEGER | 已用额度 |
| created_by | INTEGER | 分配者 ID |

#### transactions (交易流水表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| type | TEXT | `recharge`/`allocate`/`consume`/`refund` |
| amount | INTEGER | 金额 |
| team_id | INTEGER | 团队 ID |
| user_id | INTEGER | 用户 ID |
| task_id | INTEGER | 任务 ID |
| description | TEXT | 描述 |

#### tasks (任务表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| user_id | INTEGER | 用户 ID |
| team_id | INTEGER | 团队 ID |
| batch_id | TEXT | 批次 ID (UUID) |
| function_type | TEXT | 功能类型 |
| status | TEXT | `pending`/`processing`/`success`/`failed` |
| input_data | TEXT | 输入参数 (JSON) |
| output_data | TEXT | 输出结果 (JSON) |
| cost | INTEGER | 消耗积分 |

#### api_keys (平台 API Key 表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| key_value | TEXT | Key 值 |
| name | TEXT | 名称 |
| is_active | BOOLEAN | 是否启用 |

---

## 四、API 接口文档

### 4.1 认证接口

| 方法 | 路径 | 说明 | 请求体 |
|------|------|------|--------|
| POST | `/auth/register` | 团队管理员注册 | `{email, password, teamName, nickname}` |
| POST | `/auth/login` | 用户登录 | `{email, password}` |
| GET | `/auth/me` | 获取当前用户 | - |
| POST | `/auth/create-member` | 管理员创建成员 | `{email, password, nickname}` |
| POST | `/auth/change-password` | 修改密码 | `{oldPassword, newPassword}` |

### 4.2 团队接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/teams` | 获取我的团队列表 |
| GET | `/teams/:id` | 获取团队详情 |
| GET | `/teams/:id/members` | 获取成员列表 |
| DELETE | `/teams/:id/members/:userId` | 移除成员 |
| PUT | `/teams/:id/api-key` | 设置团队 API Key（管理员） |
| GET | `/teams/:id/api-key` | 获取 API Key（脱敏） |
| GET | `/teams/:id/api-key/full` | 获取完整 API Key（仅管理员） |

### 4.3 预算接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/budget/recharge` | 平台给团队充值 (需 super_admin) |
| POST | `/budget/allocate` | 团队分配额度给成员 |
| GET | `/budget/team/:teamId` | 获取团队预算 |
| GET | `/budget/user/:teamId` | 获取用户额度 |
| GET | `/transactions` | 获取交易流水 |

### 4.4 任务接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/tasks/single` | 创建单图任务 |
| POST | `/tasks/batch` | 创建批量任务 |
| GET | `/tasks` | 获取任务列表 |
| GET | `/tasks/:id` | 获取任务详情 |
| GET | `/tasks/:batchId/progress` | 获取批量进度 |

### 4.5 平台接口 (需 super_admin)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/platform/api-keys` | 创建平台 API Key |
| GET | `/platform/api-keys` | 获取所有平台 API Key |
| POST | `/platform/api-keys/:id/toggle` | 切换 API Key 状态 |
| DELETE | `/platform/api-keys/:id` | 删除 API Key |
| GET | `/platform/api-keys/active` | 获取启用的 API Key |

### 4.6 文件接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/files/upload` | 上传文件 |
| GET | `/files/download/:filename` | 下载文件 |

### 4.7 功能列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/functions` | 获取所有可用功能 |

---

## 五、核心业务流程

### 5.1 用户注册流程

```
用户填写注册表单
    ↓
提交 {email, password, teamName, nickname}
    ↓
后端验证邮箱唯一性
    ↓
1. 创建用户 (is_team_admin=1)
    ↓
2. 创建团队 (owner_id=用户 ID)
    ↓
3. 更新用户 team_id
    ↓
4. 插入 team_members (role='admin')
    ↓
5. 生成 JWT Token
    ↓
返回 {token, user}
```

### 5.2 创建成员流程

```
团队管理员发起创建
    ↓
验证管理员权限 (is_team_admin + team_id)
    ↓
检查邮箱唯一性
    ↓
创建用户 (role='member', team_id=管理员 team_id, is_team_admin=0)
    ↓
插入 team_members (role='member')
    ↓
返回成员信息
```

### 5.3 设置团队 API Key 流程

```
团队管理员提交 API Key
    ↓
验证管理员权限
    ↓
更新 teams.api_key
    ↓
团队成员可查看（脱敏）
    ↓
管理员可查看完整 Key
```

### 5.4 额度流转

```
平台 super_admin
    ↓ recharge (充值)
团队预算 (budgets)
    ↓ allocate (分配)
成员额度 (budget_allocations)
    ↓ consume (消耗)
任务执行
    ↓
交易流水记录 (transactions)
```

### 5.5 任务执行流程

```
用户创建任务
    ↓
检查用户额度是否充足
    ↓
预扣额度 (consumeBudget)
    ↓
任务加入队列 (queue.add)
    ↓
后台处理器执行 (processor)
    ↓
调用创次元 API
    ↓
更新任务状态 + 保存结果
    ↓
完成
```

---

## 六、前端页面

| 路由 | 页面 | 功能 |
|------|------|------|
| `/` | HomePage | 功能列表入口 |
| `/login` | Login | 用户登录 |
| `/register` | Register | 团队管理员注册（含团队名称） |
| `/function/:type` | FunctionPage | 功能执行页 (含团队选择、额度显示) |
| `/tasks` | Tasks | 任务列表 (分页、筛选) |
| `/tasks/:id` | TaskDetail | 任务详情 (进度、结果下载) |
| `/teams` | TeamManagement | 团队管理 (API Key 配置、成员管理、额度分配) |
| `/admin` | PlatformAdmin | 平台管理后台（仅 super_admin，含 API Key 管理、功能测试） |

---

## 七、权限设计

### 7.1 角色定义

| 角色 | 标识 | 权限 |
|------|------|------|
| 平台超级管理员 | `super_admin` | 管理所有团队、平台 API Key、预算充值 |
| 团队管理员 | `member + is_team_admin=true` | 管理团队、配置 API Key、创建成员、分配额度 |
| 普通成员 | `member` | 使用额度创建任务、查看团队资源 |

### 7.2 中间件

| 中间件 | 说明 |
|--------|------|
| `requireAuth` | 验证 JWT Token，必须登录 |
| `requireSuperAdmin` | 验证 super_admin 角色 |
| `requireTeamAdmin` | 验证团队管理员权限 |
| `optionalAuth` | 可选认证，不强制登录 |

---

## 八、部署说明

### 8.1 环境要求

- Node.js >= 18
- npm / pnpm
- 现代浏览器 (Chrome/Edge/Firefox)

### 8.2 安装步骤

```bash
# 1. 克隆项目
cd ccy-pro-version

# 2. 安装依赖
pnpm install

# 3. 配置环境变量
# 编辑 server/.env
CHCYAI_API_KEY=sk-xxxxx
JWT_SECRET=your-secret-key
DATABASE_PATH=./data/app.db

# 4. 启动开发服务器
pnpm run dev

# 5. 生产构建
pnpm run build
pnpm run start
```

### 8.3 默认账号

**平台超级管理员** (首次启动自动创建)
- 邮箱：`admin@chcyai.com`
- 密码：`admin123`（生产环境请修改）
- 角色：`super_admin`

**注意**：首次启动时日志会输出默认管理员账号信息，请妥善保管并修改密码。

### 8.4 数据库初始化

首次启动时自动：
1. 创建所有表结构
2. 创建索引
3. 插入默认管理员账号

数据文件位置：`server/data/app.db`

---

## 九、12 个 AI 功能

| 功能 ID | 名称 | 积分 |
|--------|------|------|
| image-generation | AI 生图 | 10 |
| print-generation | 打印图生成 | 5 |
| pattern-extraction | 印花提取 | 8 |
| fission | 图裂变 | 12 |
| becomes-clear | AI 变清晰 | 6 |
| clothing-upper | 服装上身 | 15 |
| clothing-wrinkle-removal | 服装去皱 | 8 |
| cut-out-portrait | 扣头像 | 5 |
| clothing-diagram | 3D 服装图 | 12 |
| garment-extractions | 服装提取 | 8 |
| intelligent-matting | 智能抠图 | 6 |
| file-upload | 文件上传 | 1 |

---

## 十、核心代码文件

### 后端核心文件

| 文件 | 行数 | 说明 |
|------|------|------|
| `server/src/database/index.ts` | ~300 | 数据库初始化 + Schema |
| `server/src/services/authService.ts` | ~200 | 认证 + 用户管理 |
| `server/src/services/teamService.ts` | ~150 | 团队 + API Key 管理 |
| `server/src/services/budgetService.ts` | ~200 | 预算 + 额度管理 |
| `server/src/services/platformService.ts` | ~80 | 平台 API Key 管理 |
| `server/src/controllers/authController.ts` | ~120 | 认证控制器 |
| `server/src/routes/api.ts` | ~80 | API 路由配置 |
| `server/src/middlewares/auth.ts` | ~100 | 认证中间件 |

### 前端核心文件

| 文件 | 行数 | 说明 |
|------|------|------|
| `client/src/App.tsx` | ~50 | 路由配置 |
| `client/src/contexts/AuthContext.tsx` | ~120 | 认证状态管理 |
| `client/src/pages/Register.tsx` | ~150 | 注册页面 |
| `client/src/pages/Login.tsx` | ~100 | 登录页面 |
| `client/src/pages/HomePage.tsx` | ~100 | 首页功能列表 |
| `client/src/pages/FunctionPage.tsx` | ~400 | 功能执行页 |
| `client/src/pages/Tasks.tsx` | ~250 | 任务列表 |
| `client/src/pages/TaskDetail.tsx` | ~200 | 任务详情 |
| `client/src/pages/TeamManagement.tsx` | ~300 | 团队管理 |
| `client/src/components/TeamSelector.tsx` | ~100 | 团队选择器 |

---

## 十一、安全设计

### 11.1 密码安全
- bcryptjs 加密，10 轮 salt
- 数据库中仅存储哈希值

### 11.2 JWT Token
- 7 天有效期
- 每次请求验证签名
- 支持 Token 刷新

### 11.3 权限控制
- 路由级权限中间件
- 业务逻辑层二次验证
- 数据访问隔离（team_id 过滤）

### 11.4 额度安全
- 预扣机制（先扣额度再执行）
- 事务保证（失败退款）
- 完整流水记录

---

## 十二、待扩展功能

### 已完成 ✅
- [x] 团队注册制（注册即创建团队）
- [x] 管理员创建成员账号
- [x] 团队 API Key 管理（配置、查看、脱敏）
- [x] 平台 API Key 管理（创建、激活、停用、删除）
- [x] 额度流转体系
- [x] 任务队列处理
- [x] 前端认证体系
- [x] 团队管理页面（API Key 配置 + 成员管理）
- [x] 平台管理后台页面（/admin）

### 待开发 📋
- [ ] 团队额度统计图表
- [ ] 邮件通知系统
- [ ] 批量任务进度实时推送
- [ ] 任务历史记录导出
- [ ] API Key 使用统计
- [ ] 操作日志审计

---

## 十三、常见问题

### Q: 如何重置管理员密码？
A: 直接修改数据库 `users` 表中的 `password_hash` 字段，使用 bcrypt 生成新哈希。

### Q: 团队 API Key 如何获取？
A: 联系创次元平台获取 API Key，团队管理员登录后在 `/teams` 页面配置。

### Q: 如何查看团队额度使用情况？
A: 团队管理员在 `/teams` 页面查看，包含总额度、已用额度、成员额度分配。

### Q: 支持一个用户加入多个团队吗？
A: 当前架构支持（通过 `team_members` 表），但前端 UI 简化为单团队模式。

### Q: 团队管理员如何创建成员账号？
A: 团队管理员登录后访问 `/teams` 页面，点击"创建成员"按钮，填写邮箱、密码和昵称即可。

### Q: 团队 API Key 如何配置？
A: 团队管理员在 `/teams` 页面选择团队后，在"团队 API Key"配置区域输入 API Key 并保存。

---

## 十四、联系与支持

- 项目位置：`D:\claude-program\ccy-pro-version`
- 技术栈：React + Node.js + SQLite
- 部署方式：单机部署 / Docker (待支持)

---

**文档结束**
