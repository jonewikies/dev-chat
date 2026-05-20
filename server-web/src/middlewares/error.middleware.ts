import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { AppError } from '../utils/error.util';
import { errorResponse } from '../utils/response.util';
import logger from '../utils/logger.util';
import { config } from '../config/app';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err instanceof AppError) {
    return res.status(err.statusCode).json(
      errorResponse(err.code, err.message, err.details)
    );
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const maxSizeMb = Math.floor(config.prototype.maxArchiveSize / (1024 * 1024));
      return res.status(413).json(
        errorResponse('FILE_TOO_LARGE', `上传文件过大，原型稿压缩包不能超过 ${maxSizeMb}MB`)
      );
    }

    return res.status(400).json(
      errorResponse('UPLOAD_ERROR', err.message)
    );
  }

  // 未知错误
  return res.status(500).json(
    errorResponse(
      'INTERNAL_ERROR',
      process.env.NODE_ENV === 'production'
        ? '服务器内部错误'
        : err.message
    )
  );
};
