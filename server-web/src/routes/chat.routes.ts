import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();
const chatController = new ChatController();

// 所有路由都需要认证
router.use(authenticate);

router.get('/', chatController.getChats);
router.post('/direct', chatController.createDirectChat);
router.post('/group', chatController.createGroupChat);
router.get('/:chatId', chatController.getChatDetail);
router.put('/:chatId', chatController.updateChat);
router.delete('/:chatId', chatController.deleteDirectChat);
router.post('/:chatId/leave', chatController.leaveChat);
router.post('/:chatId/members', chatController.addMember);
router.delete('/:chatId/members/:userId', chatController.removeMember);
router.post('/:chatId/read', chatController.markAsRead);

export default router;
