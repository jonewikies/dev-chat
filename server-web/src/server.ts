import http from 'http';
import { createApp } from './app';
import { WebSocketServer } from './websocket';
import { config } from './config/app';
import logger from './utils/logger.util';
import { startAutoSave, closeDatabase, initializeSchema, createBackup } from './database/connection';
import { initializeDefaultData } from './database/init-default-data';
import { ProjectAIAutoSummaryService } from './services/project-ai-auto-summary.service';

async function startServer() {
  try {
    // 初始化数据库
    logger.info('Initializing database...');
    await initializeSchema();
    await initializeDefaultData();
    createBackup(); // 启动时创建备份
    startAutoSave();
    logger.info('Database initialized successfully');

    // 创建 Express 应用
    const app = createApp();

    // 创建 HTTP 服务器
    const httpServer = http.createServer(app);

    // 初始化 WebSocket 服务器
    logger.info('Initializing WebSocket server...');
    new WebSocketServer(httpServer);
    logger.info('WebSocket server initialized');

    const autoSummaryService = new ProjectAIAutoSummaryService();
    autoSummaryService.start();

    // 启动服务器
    httpServer.listen(config.port, () => {
      logger.info(`Server is running on port ${config.port}`);
      logger.info(`Environment: ${config.env}`);
      logger.info(`API: http://localhost:${config.port}/api`);
      logger.info(`WebSocket: ws://localhost:${config.port}`);
    });

    // 优雅退出
    process.on('SIGTERM', () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      httpServer.close(() => {
        autoSummaryService.stop();
        logger.info('HTTP server closed');
        closeDatabase();
        logger.info('Database connection closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT signal received: closing HTTP server');
      httpServer.close(() => {
        autoSummaryService.stop();
        logger.info('HTTP server closed');
        closeDatabase();
        logger.info('Database connection closed');
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
