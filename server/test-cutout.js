// 测试创次元 API - cut-out-portrait
import axios from 'axios';

const API_KEY = 'sk-4DZU20k6iSV85-CgwGm9c6Mb';
const BASE_URL = 'https://api.chcyai.com';

// 使用一个已知的 fileId 进行测试
const REFERENCE_IMAGE_ID = '2045740285752590337';

console.log('测试 cut-out-portrait API...\n');

// 测试 1: 使用 referenceImageId (驼峰)
async function testCamelCase() {
  console.log('测试 1: 使用 referenceImageId (驼峰命名)');
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
  } catch (error: any) {
    console.log('失败:', error.response?.status, JSON.stringify(error.response?.data, null, 2));
  }
}

// 测试 2: 使用 reference_image_id (下划线)
async function testSnakeCase() {
  console.log('\n测试 2: 使用 reference_image_id (下划线命名)');
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
  } catch (error: any) {
    console.log('失败:', error.response?.status, JSON.stringify(error.response?.data, null, 2));
  }
}

// 测试 3: 同时使用两种参数名
async function testBoth() {
  console.log('\n测试 3: 同时使用两种参数名');
  try {
    const response = await axios.post(
      `${BASE_URL}/v1/cut-out-portrait/generations`,
      {
        schema: 'basic',
        referenceImageId: REFERENCE_IMAGE_ID,
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
  } catch (error: any) {
    console.log('失败:', error.response?.status, JSON.stringify(error.response?.data, null, 2));
  }
}

// 运行测试
(async () => {
  await testCamelCase();
  await testSnakeCase();
  await testBoth();
  process.exit(0);
})();
