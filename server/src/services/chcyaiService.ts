import axios from 'axios';
import FormData from 'form-data';
import { config } from '../config/index.js';
import type { FunctionType, TaskResult } from './types.js';

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
  const timestamp = new Date().toLocaleTimeString('zh-CN');
  console.log(`${LOG_PREFIX} [${timestamp}] REQUEST → ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
  console.log(`${LOG_PREFIX}           Headers: ${JSON.stringify(config.headers)}`);
  if (config.data) {
    console.log(`${LOG_PREFIX}           Body: ${JSON.stringify(config.data).substring(0, 500)}`);
  }
  config.headers.Authorization = `Bearer ${getApiKey()}`;
  return config;
});

// 响应日志
apiClient.interceptors.response.use(
  (response) => {
    const timestamp = new Date().toLocaleTimeString('zh-CN');
    console.log(`${LOG_PREFIX} [${timestamp}] RESPONSE ← ${response.status} ${response.config.url}`);
    console.log(`${LOG_PREFIX}           Data: ${JSON.stringify(response.data).substring(0, 500)}`);
    return response;
  },
  (error) => {
    const timestamp = new Date().toLocaleTimeString('zh-CN');
    console.error(`${LOG_PREFIX} [${timestamp}] ERROR ← ${error.response?.status || 'NETWORK'} ${error.config?.url}`);
    if (error.response) {
      console.error(`${LOG_PREFIX}           Status: ${error.response.status}`);
      console.error(`${LOG_PREFIX}           Data: ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      console.error(`${LOG_PREFIX}           No response received`);
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
    const timestamp = new Date().toLocaleTimeString('zh-CN');
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

      const response = await axios.post(
        `${baseUrl}/v1/files/uploads`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': `multipart/form-data; boundary=${formData.getBoundary()}`,
          },
        }
      );

      console.log(`${LOG_PREFIX} [${timestamp}] UPLOAD SUCCESS → fileId: ${response.data.data}`);
      return response.data.data; // fileId
    } catch (error) {
      console.error(`${LOG_PREFIX} [${timestamp}] UPLOAD FAILED → ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof Error && error.message.includes('401')) {
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
    const timestamp = new Date().toLocaleTimeString('zh-CN');
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
        // referenceImage (必填), dpi (必填 0-1200), selectedArea (可选), imageHeight (必填), imageWidth (必填)
        requestBody = {
          dpi: inputData.dpi ?? 300,
          imageHeight: inputData.imageHeight,
          imageWidth: inputData.imageWidth,
          fileName: inputData.fileName,
          ...(inputData.selectedArea ? { selectedArea: inputData.selectedArea } : {}),
          ...buildReferenceParams(inputData),
        };
        break;
      }

      case 'pattern-extraction': {
        // schema (必填), prompt (可选), referenceImage (必填), resolutionRatioId (必填), isPatternCompleted (必填)
        requestBody = {
          schema: inputData.schema || 'basic',
          prompt: inputData.prompt as string,
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
          aspectRatioId: inputData.aspectRatioId,
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
      console.log(`${LOG_PREFIX} [${timestamp}] EXECUTE SUCCESS → ${functionType}`);
      return response.data.data;
    } catch (error) {
      console.error(`${LOG_PREFIX} [${timestamp}] EXECUTE FAILED → ${functionType}`);
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

    const timestamp = new Date().toLocaleTimeString('zh-CN');
    console.log(`${LOG_PREFIX} [${timestamp}] QUERY → ${functionType} taskId: ${taskId}`);

    try {
      const response = await apiClient.get(endpoint);
      console.log(`${LOG_PREFIX} [${timestamp}] QUERY SUCCESS → ${functionType}`);
      return response.data.data;
    } catch (error) {
      console.error(`${LOG_PREFIX} [${timestamp}] QUERY FAILED → ${functionType}`);
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

    const timestamp = new Date().toLocaleTimeString('zh-CN');
    console.log(`${LOG_PREFIX} [${timestamp}] GET TEMP URL → ${functionType} taskId: ${taskId}`);

    try {
      const response = await apiClient.get(endpoint);
      console.log(`${LOG_PREFIX} [${timestamp}] GET TEMP URL SUCCESS → ${response.data.data.tempUrl}`);
      return response.data.data.tempUrl;
    } catch (error) {
      console.error(`${LOG_PREFIX} [${timestamp}] GET TEMP URL FAILED → ${functionType}`);
      throw error;
    }
  },
};
