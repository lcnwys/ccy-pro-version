import { join } from 'node:path';
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { config } from '../config/index.js';
import { v4 as uuidv4 } from 'uuid';

export const fileService = {
  /**
   * 保存上传的文件
   */
  saveFile: async (buffer: Buffer, originalName: string): Promise<string> => {
    const ext = originalName.split('.').pop() || 'jpg';
    const filename = `${uuidv4()}.${ext}`;
    const filepath = join(config.storage.path, filename);

    await mkdir(config.storage.path, { recursive: true });
    await writeFile(filepath, buffer);

    return filename;
  },

  /**
   * 读取文件
   */
  readFile: async (filename: string): Promise<Buffer> => {
    const filepath = join(config.storage.path, filename);
    return readFile(filepath);
  },

  /**
   * 获取文件路径
   */
  getFilePath: (filename: string): string => {
    return join(config.storage.path, filename);
  },

  /**
   * 删除文件
   */
  deleteFile: async (filename: string): Promise<void> => {
    const filepath = join(config.storage.path, filename);
    try {
      await stat(filepath);
      // MVP 阶段暂不实现删除
    } catch {
      // 文件不存在
    }
  },
};
