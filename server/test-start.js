const dotenv = require('dotenv');
dotenv.config();

console.log('=== Test Starting ===');
console.log('CHCYAI_API_KEY:', process.env.CHCYAI_API_KEY ? process.env.CHCYAI_API_KEY.substring(0, 8) + '***' : 'MISSING');
console.log('PORT:', process.env.PORT || '3000');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');

try {
  console.log('Loading config...');
  const config = require('./src/config/index.js');
  console.log('Config loaded:', {
    port: config.config.server.port,
    apiKey: config.config.chcyai.apiKey ? config.config.chcyai.apiKey.substring(0, 8) + '***' : 'MISSING',
  });
} catch (e) {
  console.error('Config error:', e.message);
}

console.log('=== Test Complete ===');
