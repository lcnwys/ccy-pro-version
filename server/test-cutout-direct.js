// 测试创次元 API - cut-out-portrait 完整流程
// 1. 上传本地图片
// 2. 调用抠图 API
// 3. 获取结果

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const API_KEY = 'sk-4DZU20k6iSV85-CgwGm9c6Mb';
const BASE_URL = 'https://api.chcyai.com';

// 使用服务器 uploads 目录中的一张图片
const IMAGE_PATH = path.join(__dirname, 'uploads', '211d31a0-9f50-48fd-86e3-ba924de21f5c.jpg');

console.log('=== 创次元 cut-out-portrait API 测试 ===\n');
console.log(`API Key: ${API_KEY.substring(0, 8)}***`);
console.log(`测试图片：${IMAGE_PATH}\n`);

// 步骤 1: 上传文件
async function uploadFile(filePath) {
  console.log('【步骤 1】上传文件...');

  if (!fs.existsSync(filePath)) {
    console.error(`文件不存在：${filePath}`);
    return null;
  }

  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const formData = new FormData();
  formData.append('file', fileBuffer, { filename: fileName });

  try {
    const response = await axios.post(
      `${BASE_URL}/v1/files/uploads`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          ...formData.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    const fileId = response.data.data;
    console.log(`上传成功！fileId: ${fileId}\n`);
    return fileId;
  } catch (error) {
    console.error('上传失败:');
    console.error('  Status:', error.response?.status);
    console.error('  Data:', JSON.stringify(error.response?.data, null, 2));
    return null;
  }
}

// 步骤 2: 调用抠图 API (使用 referenceImageId)
async function testCutoutCamelCase(fileId) {
  console.log('【步骤 2】调用 cut-out-portrait (驼峰命名 referenceImageId)...');

  try {
    const response = await axios.post(
      `${BASE_URL}/v1/cut-out-portrait/generations`,
      {
        schema: 'basic',
        referenceImageId: fileId,
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('请求成功!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return response.data.data?.taskId;
  } catch (error) {
    console.error('请求失败:');
    console.error('  Status:', error.response?.status);
    console.error('  Data:', JSON.stringify(error.response?.data, null, 2));
    console.error('  Headers:', JSON.stringify(error.response?.headers, null, 2));
    return null;
  }
}

// 步骤 3: 调用抠图 API (使用下划线命名 reference_image_id)
async function testCutoutSnakeCase(fileId) {
  console.log('\n【步骤 3】调用 cut-out-portrait (下划线命名 reference_image_id)...');

  try {
    const response = await axios.post(
      `${BASE_URL}/v1/cut-out-portrait/generations`,
      {
        schema: 'basic',
        reference_image_id: fileId,
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('请求成功!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return response.data.data?.taskId;
  } catch (error) {
    console.error('请求失败:');
    console.error('  Status:', error.response?.status);
    console.error('  Data:', JSON.stringify(error.response?.data, null, 2));
    return null;
  }
}

// 步骤 4: 查询任务结果
async function queryResult(taskId, functionName) {
  if (!taskId) return;

  console.log(`\n【步骤 4】查询任务结果 (${functionName})...`);

  try {
    const response = await axios.get(
      `${BASE_URL}/v1/query/cut-out-portrait/info/${taskId}`,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('查询成功!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('查询失败:');
    console.error('  Status:', error.response?.status);
    console.error('  Data:', JSON.stringify(error.response?.data, null, 2));
  }
}

// 主流程
async function main() {
  // 步骤 1: 上传文件
  const fileId = await uploadFile(IMAGE_PATH);
  if (!fileId) {
    console.log('\n上传失败，终止测试');
    process.exit(1);
  }

  // 等待一下，确保文件已处理
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 步骤 2: 测试驼峰命名
  const taskIdCamel = await testCutoutCamelCase(fileId);
  if (taskIdCamel) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    await queryResult(taskIdCamel, '驼峰命名');
  }

  // 步骤 3: 测试下划线命名
  const taskIdSnake = await testCutoutSnakeCase(fileId);
  if (taskIdSnake) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    await queryResult(taskIdSnake, '下划线命名');
  }

  console.log('\n=== 测试完成 ===');
  process.exit(0);
}

// 运行测试
main().catch(err => {
  console.error('测试异常:', err);
  process.exit(1);
});
