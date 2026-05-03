import TosClient from '@volcengine/tos-sdk';
import { config } from '../config/index.js';

// 初始化 TOS 客户端
let tosClient: TosClient | null = null;

const getTosClient = () => {
  if (!tosClient) {
    tosClient = new TosClient({
      accessKeyId: config.tos.accessKeyId,
      accessKeySecret: config.tos.accessKeySecret,
      region: config.tos.region,
      endpoint: `https://${config.tos.endpoint}`,
    });
  }
  return tosClient;
};

// 构建 TOS 文件访问 URL
const buildTosUrl = (fileKey: string): string => {
  if (config.tos.publicBaseUrl) {
    return `${config.tos.publicBaseUrl}/${fileKey}`;
  }
  return `https://${config.tos.bucket}.${config.tos.endpoint}/${fileKey}`;
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
      const fileKey = `${config.tos.uploadPrefix}/${key}`;

      const result = await client.putObject({
        bucket: config.tos.bucket,
        key: fileKey,
        body: buffer,
        contentLength: buffer.length,
        contentType: contentType || 'application/octet-stream',
      }) as any;

      return {
        success: true,
        fileKey,
        fileUrl: buildTosUrl(fileKey),
        etag: (result as any)?.output?.etag || (result as any)?.etag,
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
   * 从远程 URL 抓取到 TOS
   */
  fetchFromUrl: async (
    url: string,
    key: string,
    contentType?: string
  ): Promise<TosFetchResult> => {
    try {
      const axios = await import('axios');
      const response = await axios.default.get(url, {
        responseType: 'arraybuffer',
        timeout: 60000,
      });

      const buffer = Buffer.from(response.data);
      return tosService.uploadBuffer(buffer, key, contentType || response.headers['content-type']);
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
      const result = await client.getObject({
        bucket: config.tos.bucket,
        key: key,
      }) as any;

      const body = result.output || result.body || result;
      if (Buffer.isBuffer(body)) return body;
      if (body instanceof ArrayBuffer) return Buffer.from(body);

      const chunks: Buffer[] = [];
      for await (const chunk of body as AsyncIterable<Buffer>) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    } catch (error) {
      console.error('[TOS] downloadBuffer failed:', error);
      return null;
    }
  },

  /**
   * 删除 TOS 中的对象
   */
  deleteObject: async (key: string): Promise<boolean> => {
    try {
      const client = getTosClient();
      await client.deleteObject({
        bucket: config.tos.bucket,
        key: key,
      });
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
      await client.headObject({
        bucket: config.tos.bucket,
        key: key,
      });
      return true;
    } catch {
      return false;
    }
  },
};
