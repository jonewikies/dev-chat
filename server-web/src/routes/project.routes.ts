import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { ProjectController } from '../controllers/project.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireProjectPermission } from '../middlewares/permission.middleware';
import { config } from '../config/app';
import { uploadLimiter } from '../middlewares/rateLimit.middleware';

const router = Router();
const projectController = new ProjectController();
const prototypeUpload = multer({
	dest: path.join(config.prototype.dir, 'tmp'),
	limits: {
		fileSize: config.prototype.maxArchiveSize,
	},
	fileFilter: (_req, file, callback) => {
		if (!file.originalname.toLowerCase().endsWith('.zip')) {
			callback(new Error('仅支持上传 zip 压缩包'));
			return;
		}
		callback(null, true);
	},
});

// 所有路由都需要认证
router.use(authenticate);

router.get('/', projectController.getProjects);
router.post('/', projectController.createProject);
router.get('/search', projectController.searchProjects);
router.get('/:projectId', projectController.getProjectDetail);
router.put('/:projectId', requireProjectPermission('member'), projectController.updateProject);
router.delete('/:projectId', requireProjectPermission('owner'), projectController.deleteProject);
router.get('/:projectId/members', projectController.getMembers);
router.post('/:projectId/chat/open', requireProjectPermission('member'), projectController.openProjectChat);
router.get('/:projectId/ai/summaries', projectController.getAISummaries);
router.post('/:projectId/ai/summaries', requireProjectPermission('member'), projectController.createAISummary);
router.post('/:projectId/ai/summaries/:analysisId/retry', requireProjectPermission('member'), projectController.retryAISummary);
router.post('/:projectId/ai/summaries/:analysisId/keep', requireProjectPermission('member'), projectController.keepAISummary);
router.get('/:projectId/ai/proposals', projectController.getAIProposals);
router.get('/:projectId/ai/proposals/:proposalId', projectController.getAIProposalDetail);
router.post('/:projectId/ai/proposals/:proposalId/keep', requireProjectPermission('owner'), projectController.keepAIProposal);
router.post('/:projectId/ai/proposals/:proposalId/undo', requireProjectPermission('owner'), projectController.undoAIProposal);
router.post('/:projectId/members', requireProjectPermission('member'), projectController.addMember);
router.put('/:projectId/members/:memberId', requireProjectPermission('owner'), projectController.updateMemberRole);
router.delete('/:projectId/members/:memberId', requireProjectPermission('owner'), projectController.removeMember);
router.get('/:projectId/tasks', projectController.getTasks);
router.get('/:projectId/tasks/:taskId', projectController.getTaskDetail);
router.post('/:projectId/tasks', requireProjectPermission('member'), projectController.createTask);
router.put('/:projectId/tasks/:taskId', requireProjectPermission('member'), projectController.updateTask);
router.delete('/:projectId/tasks/:taskId', requireProjectPermission('member'), projectController.deleteTask);

// Bug routes
router.get('/:projectId/bugs', projectController.getBugs);
router.get('/:projectId/bugs/:bugId', projectController.getBugDetail);
router.post('/:projectId/bugs', requireProjectPermission('member'), projectController.createBug);
router.put('/:projectId/bugs/:bugId', requireProjectPermission('member'), projectController.updateBug);
router.delete('/:projectId/bugs/:bugId', requireProjectPermission('member'), projectController.deleteBug);

// Document routes
router.get('/:projectId/documents', projectController.getDocuments);
router.get('/:projectId/documents/:documentId', projectController.getDocumentDetail);
router.post('/:projectId/documents', requireProjectPermission('member'), projectController.createDocument);
router.put('/:projectId/documents/:documentId', requireProjectPermission('member'), projectController.updateDocument);
router.delete('/:projectId/documents/:documentId', requireProjectPermission('member'), projectController.deleteDocument);
router.get('/:projectId/documents/:documentId/comments', projectController.getDocumentComments);
router.post('/:projectId/documents/:documentId/comments', requireProjectPermission('member'), projectController.createDocumentComment);
router.delete('/:projectId/documents/:documentId/comments/:commentId', projectController.deleteDocumentComment);

// Repository routes
router.get('/:projectId/repositories', projectController.getRepositories);
router.get('/:projectId/repositories/:repositoryId/details', projectController.getRepositoryDetail);
router.post('/:projectId/repositories', requireProjectPermission('member'), projectController.createRepository);
router.put('/:projectId/repositories/:repositoryId', requireProjectPermission('member'), projectController.updateRepository);
router.delete('/:projectId/repositories/:repositoryId', requireProjectPermission('member'), projectController.deleteRepository);

// Prototype routes
router.get('/:projectId/prototypes', projectController.getProjectPrototypes);
router.get('/:projectId/prototypes/:prototypeId', projectController.getProjectPrototypeDetail);
router.post('/:projectId/prototypes', requireProjectPermission('member'), uploadLimiter, prototypeUpload.single('archive'), projectController.createProjectPrototype);
router.put('/:projectId/prototypes/:prototypeId', requireProjectPermission('member'), uploadLimiter, prototypeUpload.single('archive'), projectController.updateProjectPrototype);
router.delete('/:projectId/prototypes/:prototypeId', requireProjectPermission('member'), projectController.deleteProjectPrototype);

export default router;
