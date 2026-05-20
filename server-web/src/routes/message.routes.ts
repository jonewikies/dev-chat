import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { MessageController } from '../controllers/message.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { config } from '../config/app';

const router = Router();
const messageController = new MessageController();
const messageUpload = multer({
	dest: path.join(config.upload.dir, 'tmp'),
	limits: {
		fileSize: config.upload.maxSize,
	},
});

// 所有路由都需要认证
router.use(authenticate);

router.get('/attachments/:fileId', messageController.downloadAttachment);
router.get('/:chatId/messages', messageController.getMessages);
router.post('/:chatId/messages', messageController.sendMessage);
router.post('/:chatId/messages/attachments', messageUpload.single('file'), messageController.uploadAttachment);
router.post('/messages/:messageId/forward', messageController.forwardMessage);
router.put('/messages/:messageId', messageController.updateMessage);
router.delete('/messages/:messageId', messageController.deleteMessage);
router.get('/:chatId/messages/search', messageController.searchMessages);

export default router;
