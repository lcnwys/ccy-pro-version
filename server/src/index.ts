// 必须在所有导入之前加载环境变量
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiRouter } from './routes/api.js';
import { queue } from './queue/index.js';
import { createProcessor } from './queue/processor.js';
import { getDatabase, saveDatabase } from './database/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 优雅关闭时保存数据库
const gracefulShutdown = async (signal: string) => {
  console.log(`\n[API] 收到信号 ${signal}，正在关闭...`);
  try {
    await saveDatabase();
    console.log('[API] 数据库已保存');
  } catch (err) {
    console.error('[API] 数据库保存失败:', err);
  }
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// beforeExit 在事件循环为空时触发（包括 tsx watch 重启）
process.on('beforeExit', async () => {
  console.log('[API] 检测到 beforeExit，保存数据库...');
  try {
    await saveDatabase();
    console.log('[API] 数据库已保存（beforeExit）');
  } catch (err) {
    console.error('[API] 数据库保存失败（beforeExit）:', err);
  }
});

// 处理未捕获的异常
process.on('uncaughtException', (err) => {
  console.error('[API] 未捕获的异常:', err);
  // 尝试保存数据库
  saveDatabase().then(() => {
    console.log('[API] 数据库已保存');
    process.exit(1);
  }).catch(() => {
    process.exit(1);
  });
});

process.on('exit', (code) => {
  console.log(`[API] 进程退出，退出码：${code}`);
});

// 初始化数据库
getDatabase().then(() => {
  console.log('[API] 数据库已就绪');
}).catch(err => {
  console.error('[API] 数据库初始化失败:', err);
});

// 验证 API Key 配置
if (!process.env.CHCYAI_API_KEY) {
  console.error('');
  console.error('⚠️  警告：CHCYAI_API_KEY 未配置！');
  console.error('⚠️  请在 .env 文件中设置正确的 API Key');
  console.error('');
} else {
  const apiKeyPreview = process.env.CHCYAI_API_KEY.substring(0, 8) + '***';
  console.log(`[配置] API Key: ${apiKeyPreview}`);
}

const app = express();

// 请求日志中间件
app.use((req, res, next) => {
  const timestamp = new Date().toLocaleTimeString('zh-CN');
  const method = req.method;
  const url = req.url;
  const ip = req.ip || req.socket.remoteAddress;

  // 跳过静态文件和健康检查的日志
  if (!url.startsWith('/health')) {
    console.log(`[API] [${timestamp}] ${method} ${url} - IP: ${ip}`);
  }

  // 记录响应时间
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    console.log(`[API] [${timestamp}] ${method} ${url} → ${status} (${duration}ms)`);
  });

  next();
});

// 中间件
app.use(express.json());

// CORS（仅开发环境）
if (config.cors.enabled) {
  app.use(cors({
    origin: config.cors.origins,
    credentials: true,
  }));
}

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API 路由
app.use('/api/v1', apiRouter);

// 生产环境：serve 前端静态资源
if (process.env.NODE_ENV === 'production') {
  const clientPath = join(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientPath));

  app.get('*', (req, res) => {
    res.sendFile(join(clientPath, 'index.html'));
  });
}

// 初始化队列处理器
const processor = createProcessor();
queue.setProcessor(processor);

// 启动服务器
app.listen(config.server.port, config.server.host, () => {
  console.log('='.repeat(50));
  console.log('  创次元 PRO 服务启动成功');
  console.log('='.repeat(50));
  console.log(`  地址：http://${config.server.host}:${config.server.port}`);
  console.log(`  环境：${process.env.NODE_ENV || 'development'}`);
  console.log(`  API:  http://${config.server.host}:${config.server.port}/api/v1/functions`);
  console.log('='.repeat(50));
});
