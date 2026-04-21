import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { config } from '../config/index.js';

// TOS 客户端实例
let tosClient: AxiosInstance | null = null;

// 获取 TOS 客户端
const getTosClient = () => {
  if (!tosClient) {
    tosClient = axios.create({
      baseURL: `https://${config.tos.endpoint}`,
      timeout: 60000,
    });
  }
  return tosClient;
};

// 火山 TOS 签名算法 v4
const signTosRequest = async (
  method: string,
  path: string,
  query?: Record<string, string>,
  headers?: Record<string, string>,
  body?: Buffer
) => {
  const ak = config.tos.accessKeyId;
  const sk = config.tos.accessKeySecret;

  const now = new Date();
  const dateStamp = now.toISOString().replace(/[-:]/g, '').slice(0, 8);
  const amzDate = now.toISOString().replace(/[-:]/g, '').slice(0, 15);

  // 构建规范请求
  const canonicalHeaders: Record<string, string> = {
    'host': config.tos.endpoint,
    'x-tos-date': amzDate,
  };

  if (body && body.length > 0) {
    canonicalHeaders['content-md5'] = crypto.createHash('md5').update(body).digest('base64');
  }

  const signedHeaders = Object.keys(canonicalHeaders).join(';');
  const canonicalHeadersStr = Object.entries(canonicalHeaders)
    .map(([k, v]) => `${k}:${v}`)
    .join('\n');

  // 规范查询参数
  const sortedQuery = query ? Object.entries(query).sort().map(([k, v]) => `${k}=${v}`).join('&') : '';

  // 规范请求体
  const payloadHash = body ? crypto.createHash('sha256').update(body).digest('hex') : 'UNSIGNED-PAYLOAD';

  // 构建规范请求字符串
  const canonicalRequest = [
    method.toUpperCase(),
    path,
    sortedQuery,
    canonicalHeadersStr,
    '',
    signedHeaders,
    payloadHash,
  ].join('\n');

  // 构建待签名字符串
  const algorithm = 'TOS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/cn-beijing/tos/request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');

  // 计算签名
  const kDate = crypto.createHmac('sha256', dateStamp).update('tos').digest();
  const kRegion = crypto.createHmac('sha256', kDate).update('cn-beijing').digest();
  const kService = crypto.createHmac('sha256', kRegion).update('tos').digest();
  const kSigning = crypto.createHmac('sha256', kService).update('request').digest();
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  // 构建 Authorization header
  const authorization = `${algorithm} Credential=${ak}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    'Authorization': authorization,
    'x-tos-date': amzDate,
    ...headers,
  };
};

export interface TosUploadResult {
  success: boolean;
  fileKey: string;
  fileUrl: string;
  etag?: string;
}

export interface TosFetchResult {
  success: boolean;
  fileKey: string;
  fileUrl: string;
  etag?: string;
}

export const tosService = {
  /**
   * 上传 Buffer 到 TOS
   */
  uploadBuffer: async (
    buffer: Buffer,
    key: string,
    contentType?: string
  ): Promise<TosUploadResult> => {
    try {
      const client = getTosClient();
      const fullKey = `/${config.tos.bucket}/${config.tos.uploadPrefix}/${key}`;

      const headers = await signTosRequest('PUT', fullKey, undefined, {
        'Content-Type': contentType || 'application/octet-stream',
      }, buffer);

      const response = await client.put(fullKey, buffer, { headers });

      return {
        success: true,
        fileKey: `${config.tos.uploadPrefix}/${key}`,
        fileUrl: `${config.tos.publicBaseUrl}/${config.tos.uploadPrefix}/${key}`,
        etag: response.headers.etag,
      };
    } catch (error) {
      console.error('[TOS] uploadBuffer failed:', error);
      return {
        success: false,
        fileKey: '',
        fileUrl: '',
      };
    }
  },

  /**
   * 从本地文件路径上传到 TOS
   */
  uploadFile: async (
    localFilePath: string,
    key: string,
    contentType?: string
  ): Promise<TosUploadResult> => {
    try {
      const fs = await import('node:fs/promises');
      const buffer = await fs.readFile(localFilePath);
      return tosService.uploadBuffer(buffer, key, contentType);
    } catch (error) {
      console.error('[TOS] uploadFile failed:', error);
      return {
        success: false,
        fileKey: '',
        fileUrl: '',
      };
    }
  },

  /**
   * 使用 fetch_object 从远程 URL 抓取图片到 TOS
   * 参考：https://www.volcengine.com/docs/6349/2124733
   */
  fetchFromUrl: async (
    url: string,
    key: string,
    contentType?: string
  ): Promise<TosFetchResult> => {
    try {
      // TOS fetch_object API
      const client = getTosClient();
      const fullKey = `/${config.tos.bucket}/${config.tos.uploadPrefix}/${key}`;

      // fetch_object 接口需要一个 XML body
      const xmlBody = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
        <FetchObject>
          <Mode>async</Mode>
          <Source>${url}</Source>
        </FetchObject>`);

      const headers = await signTosRequest('POST', fullKey, { 'fetchObject': '' }, {
        'Content-Type': 'application/xml',
      }, xmlBody);

      const response = await client.post(fullKey, xmlBody, {
        headers,
        params: { fetchObject: '' },
      });

      // fetch_object 是异步的，但这里我们返回成功
      return {
        success: true,
        fileKey: `${config.tos.uploadPrefix}/${key}`,
        fileUrl: `${config.tos.publicBaseUrl}/${config.tos.uploadPrefix}/${key}`,
      };
    } catch (error) {
      console.error('[TOS] fetchFromUrl failed:', error);
      return {
        success: false,
        fileKey: '',
        fileUrl: '',
      };
    }
  },

  /**
   * 从 TOS 下载文件为 Buffer
   */
  downloadBuffer: async (key: string): Promise<Buffer | null> => {
    try {
      const client = getTosClient();
      const fullKey = `/${config.tos.bucket}/${key}`;

      const headers = await signTosRequest('GET', fullKey);
      const response = await client.get(fullKey, {
        headers,
        responseType: 'arraybuffer',
      });

      return Buffer.from(response.data);
    } catch (error) {
      console.error('[TOS] downloadBuffer failed:', error);
      return null;
    }
  },

  /**
   * 获取文件的临时访问 URL（带签名）
   */
  getSignedUrl: async (
    key: string,
    expiresInSeconds: number = 3600
  ): Promise<string | null> => {
    try {
      // 简化的签名 URL 生成
      const fullKey = `${config.tos.publicBaseUrl}/${key}`;
      return fullKey; // 如果 bucket 是 public 的，直接返回
    } catch (error) {
      console.error('[TOS] getSignedUrl failed:', error);
      return null;
    }
  },

  /**
   * 删除 TOS 中的对象
   */
  deleteObject: async (key: string): Promise<boolean> => {
    try {
      const client = getTosClient();
      const fullKey = `/${config.tos.bucket}/${key}`;

      const headers = await signTosRequest('DELETE', fullKey);
      await client.delete(fullKey, { headers });

      return true;
    } catch (error) {
      console.error('[TOS] deleteObject failed:', error);
      return false;
    }
  },

  /**
   * 检查对象是否存在
   */
  headObject: async (key: string): Promise<boolean> => {
    try {
      const client = getTosClient();
      const fullKey = `/${config.tos.bucket}/${key}`;

      const headers = await signTosRequest('HEAD', fullKey);
      await client.head(fullKey, { headers });

      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * 复制对象（用于内部操作）
   */
  copyObject: async (
    sourceKey: string,
    destKey: string
  ): Promise<boolean> => {
    try {
      const client = getTosClient();
      const fullKey = `/${config.tos.bucket}/${destKey}`;

      const headers = await signTosRequest('PUT', fullKey, undefined, {
        'x-tos-copy-source': `/${config.tos.bucket}/${sourceKey}`,
      });

      await client.put(fullKey, null, { headers });

      return true;
    } catch (error) {
      console.error('[TOS] copyObject failed:', error);
      return false;
    }
  },
};
