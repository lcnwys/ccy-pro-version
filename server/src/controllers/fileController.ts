import { Request, Response } from 'express';
import multer from 'multer';
import { config } from '../config/index.js';
import { fileService } from '../services/fileService.js';
import { chcyaiService } from '../services/chcyaiService.js';
import { getBeijingTime } from '../utils/time.js';
import type { AuthRequest } from '../middlewares/auth.js';
import { createMaterial } from '../services/materialService.js';

const LOG_PREFIX = '[文件服务]';

// 配置 multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.storage.maxFileSize,
  },
  fileFilter: (req, file, cb) => {
    if (config.storage.allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'));
    }
  },
});

export const fileController = {
  upload: upload.single('file'),

  handleUpload: async (req: AuthRequest, res: Response) => {
    const timestamp = getBeijingTime();

    console.log(`${LOG_PREFIX} [${timestamp}] 收到上传请求`);
    console.log(`${LOG_PREFIX}           Content-Type: ${req.headers['content-type']}`);
    console.log(`${LOG_PREFIX}           req.file: ${req.file ? 'exists' : 'missing'}`);
    console.log(`${LOG_PREFIX}           req.body: ${JSON.stringify(req.body)}`);

    try {
      if (!req.file) {
        console.error(`${LOG_PREFIX} [${timestamp}] 错误：没有文件上传`);
        return res.status(400).json({
          error: 'No file uploaded',
          hint: '请确保使用 multipart/form-data 格式，字段名为 file'
        });
      }

      const filename = req.file.originalname;
      const size = req.file.size;
      const mimetype = req.file.mimetype;

      console.log(`${LOG_PREFIX} [${timestamp}] 上传文件 filename=${filename} size=${size} type=${mimetype}`);

      // 保存文件到本地（同时上传到 TOS）
      const saveResult = await fileService.saveFile(req.file.buffer, req.file.originalname);
      console.log(`${LOG_PREFIX} [${timestamp}] 文件保存 ${saveResult.tosKey ? '到 TOS' : '到本地'} tosKey=${saveResult.tosKey || 'none'}`);

      // 调用创次元 API 上传
      console.log(`${LOG_PREFIX} [${timestamp}] 调用创次元 API 上传文件`);
      const uploadTeamId = req.body.teamId ? parseInt(req.body.teamId, 10) : undefined;
      const fileId = await chcyaiService.uploadFile(req.file.buffer, req.file.originalname, uploadTeamId);

      // 获取图片尺寸（如果是图片）
      let imageWidth: number | null = null;
      let imageHeight: number | null = null;
      if (mimetype.startsWith('image/')) {
        try {
          const sizeOf = await import('image-size');
          const dimensions = sizeOf.default(req.file.buffer);
          imageWidth = dimensions.width || null;
          imageHeight = dimensions.height || null;
          console.log(`${LOG_PREFIX} [${timestamp}] 图片尺寸 ${imageWidth}x${imageHeight}`);
        } catch (e) {
          console.warn(`${LOG_PREFIX} [${timestamp}] 获取图片尺寸失败：${e instanceof Error ? e.message : 'Unknown'}`);
        }
      }

      const requestedTeamId = typeof req.body.teamId === 'string' && req.body.teamId ? Number(req.body.teamId) : undefined;
      const teamId: number = requestedTeamId ?? req.user?.teamId ?? 0;
      const material = req.user
        ? createMaterial({
            userId: req.user.id,
            teamId,
            fileId,
            localFile: saveResult.filename,
            originalName: filename,
            mimeType: mimetype,
            sizeBytes: size,
            imageWidth,
            imageHeight,
            resultUrl: saveResult.tosUrl, // TOS 永久链接
          })
        : null;

      console.log(`${LOG_PREFIX} [${timestamp}] 上传成功 fileId=${fileId} materialId=${material?.id ?? 'none'} size=${imageWidth ? `${imageWidth}x${imageHeight}` : 'N/A'}`);

      res.json({
        success: true,
        data: {
          localFile: saveResult.filename,
          fileId,
          material,
          imageWidth,
          imageHeight,
          tosUrl: saveResult.tosUrl, // 返回 TOS URL 供前端直接使用
        },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Upload failed';
      console.error(`${LOG_PREFIX} [${timestamp}] 上传失败 error=${errorMsg}`);
      res.status(500).json({
        success: false,
        error: errorMsg,
      });
    }
  },

  download: async (req: Request, res: Response) => {
    const timestamp = getBeijingTime();
    const { filename } = req.params;

    console.log(`${LOG_PREFIX} [${timestamp}] 下载文件 filename=${filename}`);

    // 创次元 fileId 是纯数字（如 2047691156073824258）
    const isFileId = /^[0-9]{15,}$/.test(filename);

    if (isFileId) {
      try {
        console.log(`${LOG_PREFIX} [${timestamp}] 检测到 fileId，获取远程下载链接`);
        const url = await chcyaiService.getFileDownloadUrl(filename);
        res.redirect(url);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to get remote file url';
        console.error(`${LOG_PREFIX} [${timestamp}] 获取远程文件链接失败 error=${errorMsg}`);
        res.status(500).json({
          success: false,
          error: errorMsg,
        });
      }
    } else {
      // 本地文件下载
      try {
        const buffer = await fileService.readFile(filename);

        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.setHeader('Content-Type', fileService.getMimeType(filename));
        res.send(buffer);

        console.log(`${LOG_PREFIX} [${timestamp}] 下载成功 filename=${filename}`);
      } catch (error) {
        console.error(`${LOG_PREFIX} [${timestamp}] 下载失败 filename=${filename}`);
        res.status(404).json({
          success: false,
          error: 'File not found',
        });
      }
    }
  },

  getRemoteFileUrl: async (req: Request, res: Response) => {
    const timestamp = getBeijingTime();
    const { fileId } = req.params;

    console.log(`${LOG_PREFIX} [${timestamp}] 获取远程文件链接 fileId=${fileId}`);

    try {
      const url = await chcyaiService.getFileDownloadUrl(fileId);
      res.json({
        success: true,
        data: {
          fileId,
          url,
        },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to get remote file url';
      console.error(`${LOG_PREFIX} [${timestamp}] 获取远程文件链接失败 error=${errorMsg}`);
      res.status(500).json({
        success: false,
        error: errorMsg,
      });
    }
  },
};
