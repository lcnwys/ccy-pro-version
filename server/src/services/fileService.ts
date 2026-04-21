import { join } from 'node:path';
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { config } from '../config/index.js';
import { v4 as uuidv4 } from 'uuid';
import { tosService } from './tosService.js';

// 判断是否启用了 TOS 存储
const isTosEnabled = () => {
  return !!(config.tos.accessKeyId && config.tos.bucket);
};

export const fileService = {
  /**
   * 保存上传的文件（同时上传到 TOS）
   */
  saveFile: async (buffer: Buffer, originalName: string): Promise<{
    filename: string;
    tosKey?: string;
    tosUrl?: string;
  }> => {
    const ext = originalName.split('.').pop() || 'jpg';
    const filename = `${uuidv4()}.${ext}`;

    // 如果启用了 TOS，上传到 TOS
    if (isTosEnabled()) {
      const contentType = fileService.getMimeType(filename);
      const result = await tosService.uploadBuffer(buffer, filename, contentType);
      if (result.success) {
        return {
          filename,
          tosKey: result.fileKey,
          tosUrl: result.fileUrl,
        };
      }
      // TOS 上传失败时，降级到本地存储
      console.warn('[fileService] TOS upload failed, falling back to local storage');
    }

    // 本地存储（降级方案）
    const filepath = join(config.storage.path, filename);
    await mkdir(config.storage.path, { recursive: true });
    await writeFile(filepath, buffer);

    return { filename };
  },

  /**
   * 读取文件（优先从 TOS 读取）
   */
  readFile: async (filename: string): Promise<Buffer | null> => {
    // 如果启用了 TOS，尝试从 TOS 读取
    if (isTosEnabled()) {
      const key = `${config.tos.uploadPrefix}/${filename}`;
      const buffer = await tosService.downloadBuffer(key);
      if (buffer) {
        return buffer;
      }
    }

    // 降级到本地读取
    try {
      const filepath = join(config.storage.path, filename);
      return readFile(filepath);
    } catch {
      return null;
    }
  },

  /**
   * 从远程 URL 抓取图片到 TOS
   * 使用火山 TOS 的 fetch_object 接口
   */
  fetchFromUrl: async (url: string, filename?: string): Promise<{
    filename: string;
    tosKey?: string;
    tosUrl?: string;
  } | null> => {
    if (!isTosEnabled()) {
      return null;
    }

    // 从 URL 提取文件名或使用 UUID
    const ext = url.split('.').pop()?.split('?')[0] || 'jpg';
    const safeFilename = filename || `${uuidv4()}.${ext}`;

    const result = await tosService.fetchFromUrl(url, safeFilename);
    if (result.success) {
      return {
        filename: safeFilename,
        tosKey: result.fileKey,
        tosUrl: result.fileUrl,
      };
    }

    return null;
  },

  /**
   * 获取文件访问 URL（TOS 或本地）
   */
  getFileUrl: (filename: string, tosKey?: string): string => {
    if (tosKey && config.tos.publicBaseUrl) {
      return `${config.tos.publicBaseUrl}/${tosKey}`;
    }
    // 本地文件通过 API 访问
    return `${config.server.host === '0.0.0.0' ? 'http://localhost' : config.server.host}:${config.server.port}/api/v1/files/download/${filename}`;
  },

  /**
   * 获取文件路径（本地存储）
   */
  getFilePath: (filename: string): string => {
    return join(config.storage.path, filename);
  },

  getMimeType: (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      case 'jpg':
      case 'jpeg':
      default:
        return 'image/jpeg';
    }
  },

  /**
   * 删除文件
   */
  deleteFile: async (filename: string, tosKey?: string): Promise<void> => {
    // 如果存在 TOS key，优先删除 TOS 对象
    if (tosKey) {
      await tosService.deleteObject(tosKey);
    }

    // 同时删除本地文件（如果有）
    const filepath = join(config.storage.path, filename);
    try {
      await stat(filepath);
      // MVP 阶段暂不实现删除
    } catch {
      // 文件不存在
    }
  },

  /**
   * 检查文件是否存在
   */
  fileExists: async (filename: string): Promise<boolean> => {
    // 如果启用了 TOS，检查 TOS 对象
    if (isTosEnabled()) {
      const key = `${config.tos.uploadPrefix}/${filename}`;
      const exists = await tosService.headObject(key);
      if (exists) {
        return true;
      }
    }

    // 检查本地文件
    try {
      const filepath = join(config.storage.path, filename);
      await stat(filepath);
      return true;
    } catch {
      return false;
    }
  },
};
