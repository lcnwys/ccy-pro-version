import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..', '..');

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0',
  },
  database: {
    path: process.env.DATABASE_PATH || join(rootDir, 'data', 'app.db'),
  },
  storage: {
    path: process.env.STORAGE_PATH || join(rootDir, 'uploads'),
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
  chcyai: {
    baseUrl: 'https://api.chcyai.com',
    apiKey: process.env.CHCYAI_API_KEY || '',
    timeout: 300000, // 5 分钟
  },
  queue: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '3'),
  },
  workflow: {
    maxParallelItems: parseInt(process.env.WORKFLOW_MAX_PARALLEL_ITEMS || '2'),
    maxStepsPerWorkflow: parseInt(process.env.WORKFLOW_MAX_STEPS || '6'),
    maxItemsPerRun: parseInt(process.env.WORKFLOW_MAX_ITEMS || '20'),
  },
  cors: {
    enabled: true,
    origins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(','),
  },
  tos: {
    accessKeyId: process.env.TOS_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.TOS_ACCESS_KEY_SECRET || '',
    region: process.env.TOS_REGION || 'cn-beijing',
    bucket: process.env.TOS_BUCKET || '',
    endpoint: process.env.TOS_ENDPOINT || 'tos-cn-beijing.volces.com',
    publicBaseUrl: process.env.TOS_PUBLIC_BASE_URL || '',
    uploadPrefix: process.env.TOS_UPLOAD_PREFIX || 'uploads',
  },
};

export default config;
