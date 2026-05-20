import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authLimiter } from '../middlewares/rateLimit.middleware';

const router = Router();
const authController = new AuthController();

// 公开路由 - 应用限流
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);

// 需要认证的路由
router.post('/refresh', authenticate, authController.refresh);
router.post('/logout', authenticate, authController.logout);

export default router;
