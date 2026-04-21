// 测试文件上传脚本
import FormData from 'form-data';
import axios from 'axios';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_KEY = 'sk-4DZU20k6iSV85-CgwGm9c6Mb';
const BASE_URL = 'https://api.chcyai.com';

// 读取测试文件
const testFilePath = join(__dirname, '..', 'test.png');
console.log('Reading test file from:', testFilePath);

let fileBuffer;
try {
  fileBuffer = readFileSync(testFilePath);
  console.log('File loaded successfully:', fileBuffer.length, 'bytes');
} catch (err) {
  console.error('Failed to read test file:', err.message);
  process.exit(1);
}

// 构建 FormData
const formData = new FormData();
formData.append('file', fileBuffer, { filename: 'test.png' });

console.log('Sending upload request...');
console.log('URL:', `${BASE_URL}/v1/files/uploads`);
console.log('Content-Type:', formData.getHeaders()['content-type']);

// 发送请求
axios.post(`${BASE_URL}/v1/files/uploads`, formData, {
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    ...formData.getHeaders(),
  },
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
})
.then(response => {
  console.log('Upload successful!');
  console.log('Response:', JSON.stringify(response.data, null, 2));
})
.catch(error => {
  console.error('Upload failed!');
  if (error.response) {
    console.error('Status:', error.response.status);
    console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
  } else {
    console.error('Error:', error.message);
  }
})
.finally(() => {
  process.exit(0);
});
