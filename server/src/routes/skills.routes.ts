import { Router } from 'express';
import * as SkillsController from '../controllers/skills.controller.js';

const router = Router();

router.get('/', SkillsController.listSkills);
router.post('/', SkillsController.createSkill);
router.patch('/:id', SkillsController.updateSkill);
router.patch('/:id/toggle', SkillsController.toggleSkill);
router.delete('/:id', SkillsController.deleteSkill);

export default router;
