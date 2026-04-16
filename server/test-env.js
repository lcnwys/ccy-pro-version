import dotenv from 'dotenv';
import fs from 'fs';

console.log('Current directory:', process.cwd());
console.log('.env exists:', fs.existsSync('./.env'));

const result = dotenv.config();
console.log('Dotenv result:', result);

console.log('CHCYAI_API_KEY:', process.env.CHCYAI_API_KEY ? process.env.CHCYAI_API_KEY.substring(0, 8) + '***' : 'MISSING');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);

// 保持进程运行一段时间
setTimeout(() => {}, 100);
