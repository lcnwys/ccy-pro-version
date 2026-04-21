// 测试创次元 API 所有端点的参数
const axios = require('axios');

const API_KEY = 'sk-4DZU20k6iSV85-CgwGm9c6Mb';
const BASE_URL = 'https://api.chcyai.com';
const REFERENCE_IMAGE_ID = '2045740285752590337';

// 测试 cut-out-portrait 使用下划线命名
async function testCutoutSnakeCase() {
  console.log('\n=== 测试 cut-out-portrait (下划线 naming) ===');
  try {
    const response = await axios.post(
      `${BASE_URL}/v1/cut-out-portrait/generations`,
      {
        schema: 'basic',
        reference_image_id: REFERENCE_IMAGE_ID,
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('成功:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('失败:', error.response?.status);
    console.log('响应:', JSON.stringify(error.response?.data, null, 2));
  }
}

// 测试 cut-out-portrait 使用驼峰命名
async function testCutoutCamelCase() {
  console.log('\n=== 测试 cut-out-portrait (驼峰 naming) ===');
  try {
    const response = await axios.post(
      `${BASE_URL}/v1/cut-out-portrait/generations`,
      {
        schema: 'basic',
        referenceImageId: REFERENCE_IMAGE_ID,
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('成功:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('失败:', error.response?.status);
    console.log('响应:', JSON.stringify(error.response?.data, null, 2));
  }
}

(async () => {
  await testCutoutCamelCase();
  await testCutoutSnakeCase();
  process.exit(0);
})();
