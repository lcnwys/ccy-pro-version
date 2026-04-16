import dotenv from 'dotenv';
dotenv.config();

console.log('=== Test Starting ===');
console.log('CHCYAI_API_KEY:', process.env.CHCYAI_API_KEY ? 'loaded' : 'MISSING');
console.log('PORT:', process.env.PORT || '3000');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');

try {
  console.log('Loading config...');
  const { config } = await import('./src/config/index.js');
  console.log('Config loaded:', {
    port: config.server.port,
    apiKey: config.chcyai.apiKey ? config.chcyai.apiKey.substring(0, 8) + '***' : 'MISSING',
  });
} catch (e) {
  console.error('Config error:', e);
}

console.log('=== Test Complete ===');
