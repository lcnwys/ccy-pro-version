// 简单测试：直接调用创次元 API
import axios from 'axios';

const API_KEY = 'sk-4DZU20k6iSV85-CgwGm9c6Mb';
const BASE_URL = 'https://api.chcyai.com';

console.log('=== 简单测试：直接调用创次元 API ===\n');
console.log(`API Key: ${API_KEY}`);
console.log(`使用已存在的 fileId: 2045740285752590337\n`);

async function testCutout() {
  console.log('发送请求...');
  console.log('Payload:', JSON.stringify({ schema: 'basic', referenceImageId: '2045740285752590337' }));

  try {
    const response = await axios.post(
      `${BASE_URL}/v1/cut-out-portrait/generations`,
      {
        schema: 'basic',
        referenceImageId: '2045740285752590337',
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('\n✓ 请求成功!');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));

    if (response.data.data?.taskId) {
      console.log(`\n等待 3 秒查询结果...`);
      await new Promise(r => setTimeout(r, 3000));

      const queryRes = await axios.get(
        `${BASE_URL}/v1/query/cut-out-portrait/info/${response.data.data.taskId}`,
        {
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('\n查询结果:');
      console.log('Status:', queryRes.status);
      console.log('Response:', JSON.stringify(queryRes.data, null, 2));
    }
  } catch (error) {
    console.error('\n✗ 请求失败!');
    console.error('Status:', error.response?.status);
    console.error('Data:', JSON.stringify(error.response?.data, null, 2));
    console.error('Headers:', JSON.stringify(error.response?.headers, null, 2));
  }
}

testCutout();
