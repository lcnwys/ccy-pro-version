import { Request, Response } from 'express';
import multer from 'multer';
import { config } from '../config/index.js';
import { fileService } from '../services/fileService.js';
import { chcyaiService } from '../services/chcyaiService.js';

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

  handleUpload: async (req: Request, res: Response) => {
    const timestamp = new Date().toLocaleTimeString('zh-CN');

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

      // 保存文件到本地
      const localFilename = await fileService.saveFile(req.file.buffer, req.file.originalname);
      console.log(`${LOG_PREFIX} [${timestamp}] 文件保存到本地 localFilename=${localFilename}`);

      // 调用创次元 API 上传
      console.log(`${LOG_PREFIX} [${timestamp}] 调用创次元 API 上传文件`);
      const fileId = await chcyaiService.uploadFile(req.file.buffer, req.file.originalname);

      console.log(`${LOG_PREFIX} [${timestamp}] 上传成功 fileId=${fileId}`);

      res.json({
        success: true,
        data: {
          localFile: localFilename,
          fileId,
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
    const timestamp = new Date().toLocaleTimeString('zh-CN');
    const { filename } = req.params;

    console.log(`${LOG_PREFIX} [${timestamp}] 下载文件 filename=${filename}`);

    try {
      const buffer = await fileService.readFile(filename);

      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.send(buffer);

      console.log(`${LOG_PREFIX} [${timestamp}] 下载成功 filename=${filename}`);
    } catch (error) {
      console.error(`${LOG_PREFIX} [${timestamp}] 下载失败 filename=${filename}`);
      res.status(404).json({
        success: false,
        error: 'File not found',
      });
    }
  },
};
