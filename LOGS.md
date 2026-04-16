# 创次元 PRO - 日志说明

## 日志格式

所有日志都带有时间戳和模块前缀，方便排查问题。

### 日志前缀

| 前缀 | 说明 | 位置 |
|------|------|------|
| `[API]` | HTTP 请求日志 | server/src/index.ts |
| `[创次元 API]` | 调用上游 API 的日志 | server/src/services/chcyaiService.ts |
| `[文件服务]` | 文件上传/下载日志 | server/src/controllers/fileController.ts |
| `[任务服务]` | 任务创建/查询日志 | server/src/controllers/taskController.ts |
| `[任务队列]` | 任务队列处理日志 | server/src/queue/processor.ts |

## 日志示例

### 1. 启动日志
```
==================================================
  创次元 PRO 服务启动成功
==================================================
  地址：http://0.0.0.0:3000
  环境：development
  API:  http://0.0.0.0:3000/api/v1/functions
==================================================
```

### 2. API 请求日志
```
[API] [14:30:25] POST /api/v1/tasks/single - IP: ::1
[API] [14:30:25] POST /api/v1/tasks/single → 200 (15ms)
```

### 3. 任务创建日志
```
[任务服务] [14:30:25] 创建单图任务 type=image-generation batchId=abc-123
[任务服务]           inputData={"prompt":"red dress","aspectRatioId":0}
[任务服务] [14:30:25] 任务已创建 taskId=1
[任务服务] [14:30:25] 任务已加入队列 taskId=1
```

### 4. 任务队列处理日志
```
[任务队列] [14:30:26] 开始处理任务 taskId=1 type=image-generation
[任务队列] [14:30:26] 任务状态更新为 processing taskId=1
[任务队列] [14:30:26] 调用创次元 API taskId=1
[创次元 API] [14:30:26] REQUEST → POST https://api.chcyai.com/v1/images/generations
[创次元 API]           Headers: {"Content-Type":"application/json","Authorization":"Bearer sk-***"}
[创次元 API]           Body: {"prompt":"red dress","aspectRatioId":0}
[创次元 API] [14:30:28] RESPONSE ← 200 /v1/images/generations
[创次元 API]           Data: {"data":{"taskId":"xyz-789"},"requestId":"req-123","status":"REQUEST_SUCCESS"}
[任务队列] [14:30:28] 任务完成 taskId=1 status=success
```

### 5. 文件上传日志
```
[文件服务] [14:25:10] 上传文件 filename=dress.jpg size=245000 type=image/jpeg
[文件服务] [14:25:10] 文件保存到本地 localFilename=uuid-123.jpg
[文件服务] [14:25:10] 调用创次元 API 上传文件
[创次元 API] [14:25:10] UPLOAD FILE → dress.jpg (245000 bytes)
[创次元 API] [14:25:12] UPLOAD SUCCESS → fileId=file-456
[文件服务] [14:25:12] 上传成功 fileId=file-456
```

### 6. 错误日志
```
[任务队列] [14:30:30] 任务失败 taskId=2 error=INSUFFICIENT_BALANCE
[API] [14:30:30] POST /api/v1/tasks/batch → 500 (120ms)
```

## 排查问题流程

### 问题 1: 任务创建成功但没有执行

1. 查看 `[任务服务]` 日志，确认任务已创建
2. 查看 `[任务队列]` 日志，确认任务已开始处理
3. 查看 `[创次元 API]` 日志，确认请求已发送

### 问题 2: API 调用失败

1. 查看 `[创次元 API]` 日志中的 REQUEST 和 RESPONSE
2. 检查请求参数是否正确
3. 检查返回的错误码和错误信息

### 问题 3: 文件上传失败

1. 查看 `[文件服务]` 日志，确认文件已接收
2. 查看 `[创次元 API]` 日志，确认上传请求
3. 检查文件大小和格式是否符合要求

### 问题 4: 批量任务部分失败

1. 查看 `[任务队列]` 日志，找到失败的任务 ID
2. 查看该任务的详细错误信息
3. 检查是否是余额不足或参数错误

## 日志级别

当前所有日志都输出到控制台：

- `console.log` - 正常流程日志
- `console.error` - 错误日志

如需调整日志级别，可以在各模块中添加环境变量控制。

## 日志文件

如需将日志保存到文件，可以修改 `server/src/index.ts`，添加以下配置：

```typescript
import fs from 'fs';
import path from 'path';

const logDir = './logs';
fs.mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, `${new Date().toISOString().split('T')[0]}.log`);

// 保存日志到文件
const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
  const line = `[LOG] ${args.join(' ')}\n`;
  fs.appendFileSync(logFile, line);
  originalLog(...args);
};

console.error = (...args) => {
  const line = `[ERROR] ${args.join(' ')}\n`;
  fs.appendFileSync(logFile, line);
  originalError(...args);
};
```
