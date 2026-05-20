import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireSuperAdmin } from '../middlewares/super-admin.middleware';

const router = Router();
const userController = new UserController();

// 所有路由都需要认证
router.use(authenticate);

router.get('/admin/users', requireSuperAdmin, userController.adminListUsers);
router.post('/admin/users', requireSuperAdmin, userController.adminCreateUser);
router.post('/admin/users/batch', requireSuperAdmin, userController.adminBatchCreateUsers);
router.post('/admin/users/:id/reset-password', requireSuperAdmin, userController.adminResetPassword);

// 当前用户信息（放在最前面，避免被 /:id 路由匹配）
router.get('/me', userController.getProfile);
router.put('/me', userController.updateProfile);
router.post('/me/change-password', userController.changePassword);
router.get('/me/friends', userController.getFriends);
router.post('/me/friends', userController.sendFriendRequest);

// 用户资料（保留兼容性）
router.get('/profile/me', userController.getProfile);
router.put('/profile', userController.updateProfile);

// 用户搜索和列表（带查询参数则为搜索，否则返回列表）
router.get('/', userController.searchUsers);
router.get('/search', userController.searchUsers);

// 好友管理
router.get('/friends', userController.getFriends);
router.put('/friends/:friendshipId', userController.acceptFriendRequest);
router.delete('/friends/:friendshipId', userController.deleteFriendship);

// 用户信息 - 必须放在最后，避免与其他路由冲突
router.get('/:id', userController.getUserById);
router.put('/:id', userController.updateUser);
router.get('/:id/friends', userController.getUserFriends);
router.post('/:id/friends', userController.sendFriendRequest);

export default router;
