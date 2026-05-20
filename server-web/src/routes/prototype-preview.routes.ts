import { Router } from 'express';
import { PrototypePreviewController } from '../controllers/prototype-preview.controller';

const router = Router();
const controller = new PrototypePreviewController();

router.options('/:previewKey', controller.handleOptions);
router.options('/:previewKey/*', controller.handleOptions);
router.get('/:previewKey', controller.servePreview);
router.get('/:previewKey/*', controller.servePreview);

export default router;