import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import chatRoutes from './chat.routes';
import messageRoutes from './message.routes';
import projectRoutes from './project.routes';
import { formatLocalIsoDateTime } from '../utils/date-time.util';

const router = Router();

// API版本前缀
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/chats', chatRoutes);
router.use('/chats', messageRoutes); // /chats/:chatId/messages
router.use('/projects', projectRoutes);

// 健康检查
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: formatLocalIsoDateTime(new Date()),
    },
  });
});

export default router;
