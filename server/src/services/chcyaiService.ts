import axios from 'axios';
import FormData from 'form-data';
import { config } from '../config/index.js';
import { getBeijingTime } from '../utils/time.js';
import type { FunctionType, TaskResult } from './types.js';
import { tosService } from './tosService.js';
import { v4 as uuidv4 } from 'uuid';

const LOG_PREFIX = '[创次元 API]';

// 动态获取 API Key（每次调用时读取最新值）
const getApiKey = () => process.env.CHCYAI_API_KEY || config.chcyai.apiKey;

const apiClient = axios.create({
  baseURL: config.chcyai.baseUrl,
  timeout: config.chcyai.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求日志
apiClient.interceptors.request.use((config) => {
  const timestamp = getBeijingTime();
  const fullUrl = `${config.baseURL}${config.url}`;
  const apiKey = getApiKey();

  console.log(`${LOG_PREFIX} [${timestamp}] REQUEST → ${config.method?.toUpperCase()} ${fullUrl}`);
  console.log(`${LOG_PREFIX}           Full URL: ${fullUrl}`);
  console.log(`${LOG_PREFIX}           API Key: ${apiKey ? apiKey.substring(0, 15) + '...' : 'MISSING'}`);
  config.headers.Authorization = `Bearer ${apiKey}`;
  console.log(`${LOG_PREFIX}           Headers: ${JSON.stringify({ ...config.headers, Authorization: 'Bearer ' + apiKey?.substring(0, 8) + '***' }, null, 2)}`);
  if (config.data) {
    const dataStr = JSON.stringify(config.data, null, 2);
    console.log(`${LOG_PREFIX}           Body: ${dataStr}`);
  }
  return config;
});

// 响应日志
apiClient.interceptors.response.use(
  (response) => {
    const timestamp = getBeijingTime();
    console.log(`${LOG_PREFIX} [${timestamp}] RESPONSE ← ${response.status} ${response.config.url}`);
    console.log(`${LOG_PREFIX}           Duration: ${response.config.time ? Date.now() - response.config.time : 'N/A'}ms`);
    const dataStr = JSON.stringify(response.data, null, 2);
    console.log(`${LOG_PREFIX}           Data: ${dataStr}`);
    return response;
  },
  (error) => {
    const timestamp = getBeijingTime();
    console.error(`${LOG_PREFIX} [${timestamp}] ERROR ← ${error.response?.status || 'NETWORK'} ${error.config?.url}`);
    if (error.response) {
      console.error(`${LOG_PREFIX}           Status: ${error.response.status}`);
      console.error(`${LOG_PREFIX}           Headers: ${JSON.stringify(error.response.headers, null, 2)}`);
      const dataStr = JSON.stringify(error.response.data, null, 2);
      console.error(`${LOG_PREFIX}           Data: ${dataStr}`);
      console.error(`${LOG_PREFIX}           Request ID: ${error.response.data?.requestId || 'N/A'}`);
      console.error(`${LOG_PREFIX}           Method: ${error.config?.method?.toUpperCase() || 'N/A'}`);
      if (error.config?.data) {
        try {
          const reqData = JSON.parse(error.config.data);
          console.error(`${LOG_PREFIX}           Request Body: ${JSON.stringify(reqData, null, 2)}`);
        } catch {
          console.error(`${LOG_PREFIX}           Request Body: ${error.config.data}`);
        }
      }
    } else if (error.request) {
      console.error(`${LOG_PREFIX}           No response received`);
      console.error(`${LOG_PREFIX}           Request: ${JSON.stringify(error.request, null, 2)}`);
    } else {
      console.error(`${LOG_PREFIX}           Error: ${error.message}`);
    }
    return Promise.reject(error);
  }
);

// 辅助函数：构建参考图参数
function buildReferenceParams(inputData: Record<string, unknown>) {
  const result: Record<string, unknown> = {};

  // 单图参考（ID/URL/Base64 三选一）
  if (inputData.referenceImageId) result.referenceImageId = inputData.referenceImageId;
  if (inputData.referenceImageUrl) result.referenceImageUrl = inputData.referenceImageUrl;
  if (inputData.referenceImageBase64) result.referenceImageBase64 = inputData.referenceImageBase64;

  // 多参考图（列表形式）
  if (inputData.referenceImageIdList) result.referenceImageIdList = inputData.referenceImageIdList;
  if (inputData.referenceImageUrlList) result.referenceImageUrlList = inputData.referenceImageUrlList;
  if (inputData.referenceImageBase64List) result.referenceImageBase64List = inputData.referenceImageBase64List;

  return result;
}

export const chcyaiService = {
  /**
   * 上传文件
   */
  uploadFile: async (file: Buffer, filename: string): Promise<string> => {
    const timestamp = getBeijingTime();
    console.log(`${LOG_PREFIX} [${timestamp}] UPLOAD FILE → ${filename} (${file.length} bytes)`);

    const apiKey = getApiKey();
    const baseUrl = config.chcyai.baseUrl;

    console.log(`${LOG_PREFIX}           Base URL: ${baseUrl}`);
    console.log(`${LOG_PREFIX}           API Key: ${apiKey ? apiKey.substring(0, 8) + '***' : 'MISSING'}`);
    console.log(`${LOG_PREFIX}           Full Authorization: Bearer ${apiKey ? apiKey.substring(0, 15) + '...' : 'MISSING'}`);

    const formData = new FormData();
    formData.append('file', file, { filename });

    try {
      console.log(`${LOG_PREFIX}           Sending POST to ${baseUrl}/v1/files/uploads`);
      console.log(`${LOG_PREFIX}           FormData Content-Type: ${formData.getHeaders()['content-type']}`);
      console.log(`${LOG_PREFIX}           File size: ${file.length} bytes`);

      // 使用 FormData 时，让 axios 自动设置 Content-Type 和 boundary
      const response = await axios.post(`${baseUrl}/v1/files/uploads`, formData, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...formData.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      console.log(`${LOG_PREFIX} [${timestamp}] UPLOAD SUCCESS → fileId: ${response.data.data}`);
      return response.data.data; // fileId
    } catch (error) {
      const axiosError = error as any;
      console.error(`${LOG_PREFIX} [${timestamp}] UPLOAD FAILED → ${axiosError.message}`);
      console.error(`${LOG_PREFIX}           Status: ${axiosError.response?.status || 'N/A'}`);
      console.error(`${LOG_PREFIX}           Response: ${JSON.stringify(axiosError.response?.data)}`);
      console.error(`${LOG_PREFIX}           Headers: ${JSON.stringify(axiosError.response?.headers)}`);
      if (axiosError.response?.status === 401) {
        console.error(`${LOG_PREFIX}           认证失败，请检查 API Key 是否正确`);
        console.error(`${LOG_PREFIX}           当前 API Key: ${apiKey ? apiKey.substring(0, 15) + '...' : 'MISSING'}`);
        console.error(`${LOG_PREFIX}           请求 URL: ${baseUrl}/v1/files/uploads`);
      }
      throw error;
    }
  },

  /**
   * 执行 AI 功能
   */
  execute: async (functionType: FunctionType, inputData: Record<string, unknown>): Promise<TaskResult> => {
    const endpointMap: Record<FunctionType, string> = {
      'image-generation': '/v1/images/generations',
      'print-generation': '/v1/prints/generations',
      'pattern-extraction': '/v1/pattern-extraction/generations',
      'fission': '/v1/fission/generations',
      'becomes-clear': '/v1/becomes-clear/generations',
      'clothing-upper': '/v1/clothing-upper/generations',
      'clothing-wrinkle-removal': '/v1/clothing-wrinkle-removal/generations',
      'cut-out-portrait': '/v1/cut-out-portrait/generations',
      'clothing-diagram': '/v1/clothing-diagram/generations',
      'garment-extractions': '/v1/garment-extractions/generations',
      'intelligent-matting': '/v1/intelligent-matting/generations',
      'file-upload': '/v1/files/uploads',
    };

    const endpoint = endpointMap[functionType];
    const timestamp = getBeijingTime();
    console.log(`${LOG_PREFIX} [${timestamp}] EXECUTE → ${functionType} ${endpoint}`);
    console.log(`${LOG_PREFIX}           Input: ${JSON.stringify(inputData).substring(0, 500)}`);

    // 根据不同功能构建请求体
    let requestBody: Record<string, unknown> = {};

    switch (functionType) {
      case 'image-generation': {
        // prompt (必填), aspectRatioId (可选), resolutionRatioId (必填), referenceImage (可选)
        requestBody = {
          schema: inputData.schema || 'basic',
          prompt: inputData.prompt as string,
          aspectRatioId: inputData.aspectRatioId ?? 0,
          resolutionRatioId: inputData.resolutionRatioId ?? 0,
          fileName: inputData.fileName,
          ...buildReferenceParams(inputData),
        };
        break;
      }

      case 'print-generation': {
        // referenceImage (必填), dpi (必填 0-1200), imageHeight (必填), imageWidth (必填)
        requestBody = {
          dpi: inputData.dpi ?? 300,
          imageHeight: inputData.imageHeight,
          imageWidth: inputData.imageWidth,
          fileName: inputData.fileName,
          ...buildReferenceParams(inputData),
        };
        break;
      }

      case 'pattern-extraction': {
        // schema (必填), prompt (可选), referenceImage (必填), aspectRatioId (必填), resolutionRatioId (必填), isPatternCompleted (必填)
        requestBody = {
          schema: inputData.schema || 'basic',
          prompt: inputData.prompt as string,
          aspectRatioId: inputData.aspectRatioId ?? 0,
          resolutionRatioId: inputData.resolutionRatioId ?? 0,
          isPatternCompleted: inputData.isPatternCompleted ?? 0,
          fileName: inputData.fileName,
          ...buildReferenceParams(inputData),
        };
        break;
      }

      case 'fission': {
        // schema (必填), prompt (可选), referenceImage (必填), similarity (必填 0.01-1), resolutionRatioId (必填), aspectRatioId (必填)
        requestBody = {
          schema: inputData.schema || 'basic',
          prompt: inputData.prompt as string,
          similarity: inputData.similarity ?? 0.8,
          resolutionRatioId: inputData.resolutionRatioId ?? 0,
          aspectRatioId: inputData.aspectRatioId ?? 0,
          fileName: inputData.fileName,
          ...buildReferenceParams(inputData),
        };
        break;
      }

      case 'becomes-clear': {
        // schema (必填), referenceImage (必填), primaryId (可选)
        requestBody = {
          schema: inputData.schema || 'basic',
          primaryId: inputData.primaryId,
          fileName: inputData.fileName,
          ...buildReferenceParams(inputData),
        };
        break;
      }

      case 'clothing-upper': {
        // schema (必填), tops/bottoms referenceImage (至少一个), customTalentFile (可选), customReferenceImage (可选), aspectRatioId (必填), resolutionRatioId (必填), prompt (可选)
        requestBody = {
          schema: inputData.schema || 'basic',
          prompt: inputData.prompt as string,
          aspectRatioId: inputData.aspectRatioId ?? 0,
          resolutionRatioId: inputData.resolutionRatioId ?? 0,
          fileName: inputData.fileName,
          // 上装参考
          topsReferenceImageId: inputData.topsReferenceImageId,
          topsReferenceImageUrl: inputData.topsReferenceImageUrl,
          topsReferenceImageBase64: inputData.topsReferenceImageBase64,
          // 下装参考
          bottomsReferenceImageId: inputData.bottomsReferenceImageId,
          bottomsReferenceImageUrl: inputData.bottomsReferenceImageUrl,
          bottomsReferenceImageBase64: inputData.bottomsReferenceImageBase64,
          // 自定义模特
          customTalentFileId: inputData.customTalentFileId,
          customTalentFileUrl: inputData.customTalentFileUrl,
          customTalentFileBase64: inputData.customTalentFileBase64,
          // 场景/姿势参考
          customReferenceImageFileId: inputData.customReferenceImageFileId,
          customReferenceImageFileUrl: inputData.customReferenceImageFileUrl,
          customReferenceImageFileBase64: inputData.customReferenceImageFileBase64,
        };
        break;
      }

      case 'clothing-wrinkle-removal': {
        // schema (必填), referenceImage (必填), aspectRatioId (必填), resolutionRatioId (必填), prompt (可选)
        requestBody = {
          schema: inputData.schema || 'basic',
          prompt: inputData.prompt as string,
          aspectRatioId: inputData.aspectRatioId ?? 0,
          resolutionRatioId: inputData.resolutionRatioId ?? 0,
          fileName: inputData.fileName,
          ...buildReferenceParams(inputData),
        };
        break;
      }

      case 'cut-out-portrait': {
        // schema (必填), referenceImage (必填)
        requestBody = {
          schema: inputData.schema || 'basic',
          fileName: inputData.fileName,
          ...buildReferenceParams(inputData),
        };
        break;
      }

      case 'clothing-diagram': {
        // schema (必填), referenceImage (必填), aspectRatioId (必填), resolutionRatioId (必填), exampleId (可选), prompt (可选)
        requestBody = {
          schema: inputData.schema || 'basic',
          prompt: inputData.prompt as string,
          exampleId: inputData.exampleId,
          aspectRatioId: inputData.aspectRatioId ?? 0,
          resolutionRatioId: inputData.resolutionRatioId ?? 0,
          fileName: inputData.fileName,
          ...buildReferenceParams(inputData),
        };
        break;
      }

      case 'garment-extractions': {
        // schema (必填), referenceImage (必填), backgroundId (必填 1-2), aspectRatioId (可选), resolutionRatioId (必填), prompt (可选)
        requestBody = {
          schema: inputData.schema || 'basic',
          prompt: inputData.prompt as string,
          backgroundId: inputData.backgroundId ?? 1,
          aspectRatioId: inputData.aspectRatioId ?? 0,
          resolutionRatioId: inputData.resolutionRatioId ?? 0,
          fileName: inputData.fileName,
          ...buildReferenceParams(inputData),
        };
        break;
      }

      case 'intelligent-matting': {
        // schema (必填), referenceImage (必填), smooth (可选 0-10)
        requestBody = {
          schema: inputData.schema || 'basic',
          smooth: inputData.smooth ?? 0,
          fileName: inputData.fileName,
          ...buildReferenceParams(inputData),
        };
        break;
      }

      default:
        requestBody = { ...inputData };
    }

    // 移除 undefined 值
    Object.keys(requestBody).forEach(key => {
      if (requestBody[key] === undefined) {
        delete requestBody[key];
      }
    });

    try {
      const response = await apiClient.post(endpoint, requestBody);
      console.log(`${LOG_PREFIX} [${getBeijingTime()}] EXECUTE SUCCESS → ${functionType}`);
      return response.data.data;
    } catch (error) {
      console.error(`${LOG_PREFIX} [${getBeijingTime()}] EXECUTE FAILED → ${functionType}`);
      // 包装错误信息，保留完整的响应数据
      if (error instanceof Error) {
        const axiosError = error as any;
        const wrappedError = new Error(
          `创次元 API 调用失败：${axiosError.response?.data?.error?.message || axiosError.message}`
        );
        (wrappedError as any).statusCode = axiosError.response?.status;
        (wrappedError as any).responseData = axiosError.response?.data;
        (wrappedError as any).requestId = axiosError.response?.data?.requestId;
        throw wrappedError;
      }
      throw error;
    }
  },

  /**
   * 查询任务结果
   */
  queryResult: async (functionType: FunctionType, taskId: string): Promise<TaskResult> => {
    const endpointMap: Record<FunctionType, string> = {
      'image-generation': `/v1/query/images/info/${taskId}`,
      'print-generation': `/v1/query/prints/info/${taskId}`,
      'pattern-extraction': `/v1/query/pattern-extraction/info/${taskId}`,
      'fission': `/v1/query/fission/info/${taskId}`,
      'becomes-clear': `/v1/query/becomes-clear/info/${taskId}`,
      'clothing-upper': `/v1/query/clothing-upper/info/${taskId}`,
      'clothing-wrinkle-removal': `/v1/query/clothing-wrinkle-removal/info/${taskId}`,
      'cut-out-portrait': `/v1/query/cut-out-portrait/info/${taskId}`,
      'clothing-diagram': `/v1/query/clothing-diagram/info/${taskId}`,
      'garment-extractions': `/v1/query/garment-extractions/info/${taskId}`,
      'intelligent-matting': `/v1/query/intelligent-matting/info/${taskId}`,
      'file-upload': '',
    };

    const endpoint = endpointMap[functionType];
    if (!endpoint) throw new Error('Invalid function type');

    const timestamp = getBeijingTime();
    console.log(`${LOG_PREFIX} [${timestamp}] QUERY → ${functionType} taskId: ${taskId}`);

    try {
      const response = await apiClient.get(endpoint);
      console.log(`${LOG_PREFIX} [${timestamp}] QUERY SUCCESS → ${functionType}`);
      return response.data.data;
    } catch (error) {
      console.error(`${LOG_PREFIX} [${timestamp}] QUERY FAILED → ${functionType}`);
      // 包装错误信息
      if (error instanceof Error) {
        const axiosError = error as any;
        const wrappedError = new Error(
          `创次元查询失败：${axiosError.response?.data?.error?.message || axiosError.message}`
        );
        (wrappedError as any).statusCode = axiosError.response?.status;
        (wrappedError as any).responseData = axiosError.response?.data;
        throw wrappedError;
      }
      throw error;
    }
  },

  /**
   * 获取临时下载 URL
   */
  getTempUrl: async (functionType: FunctionType, taskId: string): Promise<string> => {
    const endpointMap: Record<FunctionType, string> = {
      'image-generation': `/v1/query/images/getTempUrlInfo/${taskId}`,
      'print-generation': `/v1/query/prints/getTempUrlInfo/${taskId}`,
      'pattern-extraction': `/v1/query/pattern-extraction/getTempUrlInfo/${taskId}`,
      'fission': `/v1/query/fission/getTempUrlInfo/${taskId}`,
      'becomes-clear': `/v1/query/becomes-clear/getTempUrlInfo/${taskId}`,
      'clothing-upper': `/v1/query/clothing-upper/getTempUrlInfo/${taskId}`,
      'clothing-wrinkle-removal': `/v1/query/clothing-wrinkle-removal/getTempUrlInfo/${taskId}`,
      'cut-out-portrait': `/v1/query/cut-out-portrait/getTempUrlInfo/${taskId}`,
      'clothing-diagram': `/v1/query/clothing-diagram/getTempUrlInfo/${taskId}`,
      'garment-extractions': `/v1/query/garment-extractions/getTempUrlInfo/${taskId}`,
      'intelligent-matting': `/v1/query/intelligent-matting/getTempUrlInfo/${taskId}`,
      'file-upload': '',
    };

    const endpoint = endpointMap[functionType];
    if (!endpoint) throw new Error('Invalid function type');

    const timestamp = getBeijingTime();
    console.log(`${LOG_PREFIX} [${timestamp}] GET TEMP URL → ${functionType} taskId: ${taskId}`);

    try {
      const response = await apiClient.get(endpoint);
      console.log(`${LOG_PREFIX} [${timestamp}] GET TEMP URL SUCCESS → ${response.data.data.tempUrl}`);
      return response.data.data.tempUrl;
    } catch (error) {
      console.error(`${LOG_PREFIX} [${timestamp}] GET TEMP URL FAILED → ${functionType}`);
      // 包装错误信息
      if (error instanceof Error) {
        const axiosError = error as any;
        const wrappedError = new Error(
          `获取临时 URL 失败：${axiosError.response?.data?.error?.message || axiosError.message}`
        );
        (wrappedError as any).statusCode = axiosError.response?.status;
        (wrappedError as any).responseData = axiosError.response?.data;
        throw wrappedError;
      }
      throw error;
    }
  },

  getFileDownloadUrl: async (fileId: string): Promise<string> => {
    const timestamp = getBeijingTime();
    console.log(`${LOG_PREFIX} [${timestamp}] GET FILE DOWNLOAD URL → fileId: ${fileId}`);

    try {
      const response = await apiClient.get(`/v1/files/downloads/${fileId}`);
      console.log(`${LOG_PREFIX} [${timestamp}] GET FILE DOWNLOAD URL SUCCESS`);
      return response.data.data as string;
    } catch (error) {
      console.error(`${LOG_PREFIX} [${timestamp}] GET FILE DOWNLOAD URL FAILED → fileId=${fileId}`);
      throw error;
    }
  },

  /**
   * 将创字元的临时 URL 转存到 TOS 持久化存储
   * 使用火山 TOS 的 fetch_object 接口直接抓取远程 URL
   */
  persistResultToTos: async (
    tempUrl: string,
    functionType: FunctionType,
    taskId: string
  ): Promise<string | null> => {
    // 检查是否启用了 TOS
    if (!config.tos.accessKeyId || !config.tos.bucket) {
      console.warn('[TOS] Not configured, skipping persistence');
      return null;
    }

    try {
      const timestamp = getBeijingTime();
      // 生成唯一的文件 key：results/{functionType}/{taskId}/{uuid}.{ext}
      const ext = tempUrl.split('.').pop()?.split('?')[0] || 'jpg';
      const fileKey = `results/${functionType}/${taskId}/${uuidv4()}.${ext}`;

      console.log(`${LOG_PREFIX} [${timestamp}] PERSIST TO TOS → functionType=${functionType} taskId=${taskId}`);
      console.log(`${LOG_PREFIX}           tempUrl=${tempUrl.substring(0, 80)}...`);
      console.log(`${LOG_PREFIX}           fileKey=${fileKey}`);

      const result = await tosService.fetchFromUrl(tempUrl, fileKey);

      if (result.success) {
        console.log(`${LOG_PREFIX} [${timestamp}] PERSIST SUCCESS → tosUrl=${result.fileUrl}`);
        return result.fileUrl;
      } else {
        console.error(`${LOG_PREFIX} [${timestamp}] PERSIST FAILED`);
        return null;
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} [${getBeijingTime()}] PERSIST TO TOS FAILED`, error);
      return null;
    }
  },
};

// 测试用：直接运行一次 cut-out-portrait 测试
export const runCutoutTest = async () => {
  const fs = await import('fs');
  const path = await import('path');

  const IMAGE_PATH = path.join(process.cwd(), 'uploads', '211d31a0-9f50-48fd-86e3-ba924de21f5c.jpg');
  const API_KEY = process.env.CHCYAI_API_KEY || 'sk-4DZU20k6iSV85-CgwGm9c6Mb';
  const BASE_URL = 'https://api.chcyai.com';

  console.log('\n=== [TEST] cut-out-portrait 测试开始 ===');
  console.log(`[TEST] 图片路径：${IMAGE_PATH}`);
  console.log(`[TEST] API Key: ${API_KEY.substring(0, 8)}***`);

  // 1. 上传文件
  if (!fs.existsSync(IMAGE_PATH)) {
    console.log(`[TEST] 文件不存在：${IMAGE_PATH}`);
    return;
  }

  const fileBuffer = fs.readFileSync(IMAGE_PATH);
  const fileId = await chcyaiService.uploadFile(fileBuffer, 'test-cutout.jpg');
  console.log(`[TEST] 上传成功 fileId: ${fileId}`);

  // 2. 调用抠图 API
  const result = await chcyaiService.execute('cut-out-portrait', {
    schema: 'basic',
    referenceImageId: fileId,
  });
  console.log(`[TEST] 调用成功 taskId: ${result.taskId}`);

  // 3. 等待并查询结果
  console.log('[TEST] 等待 3 秒后查询结果...');
  await new Promise(r => setTimeout(r, 3000));

  const queryResult = await chcyaiService.queryResult('cut-out-portrait', result.taskId);
  console.log(`[TEST] 查询结果 status: ${queryResult.status}`);
  console.log('[TEST] 完整结果:', JSON.stringify(queryResult, null, 2));
  console.log('=== [TEST] 测试结束 ===\n');
};
