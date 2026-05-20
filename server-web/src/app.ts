import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config, isAllowedCorsOrigin } from './config/app';
import routes from './routes';
import prototypePreviewRoutes from './routes/prototype-preview.routes';
import { errorHandler } from './middlewares/error.middleware';
import { generalLimiter } from './middlewares/rateLimit.middleware';
import logger from './utils/logger.util';

export function createApp(): Application {
  const app = express();

  // Prototype preview needs custom sandbox headers and null-origin XHR support.
  app.use('/prototype-preview', prototypePreviewRoutes);

  // 安全中间件
  app.use(helmet());

  // CORS
  app.use(
    cors({
      origin: (origin, callback) => {
        if (isAllowedCorsOrigin(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`Origin not allowed by CORS: ${origin || 'unknown'}`));
      },
      credentials: config.cors.credentials,
    })
  );

  // 请求日志
  app.use(
    morgan('combined', {
      stream: {
        write: (message) => logger.info(message.trim()),
      },
    })
  );

  // 解析请求体
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 速率限制
  app.use(generalLimiter);

  // API 路由
  app.use('/api', routes);

  // 404 处理
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: '请求的资源不存在',
      },
    });
  });

  // 错误处理
  app.use(errorHandler);

  return app;
}
