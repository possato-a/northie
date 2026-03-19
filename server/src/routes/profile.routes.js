import { Router } from 'express';
import { deleteAccount } from '../controllers/profile.controller.js';
const router = Router();
router.delete('/', deleteAccount);
export default router;
//# sourceMappingURL=profile.routes.js.map