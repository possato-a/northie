import { Router } from 'express';
import * as ContextController from '../controllers/context.controller.js';

const router = Router();

router.get('/', ContextController.getContext);
router.post('/', ContextController.saveContext);

export default router;
