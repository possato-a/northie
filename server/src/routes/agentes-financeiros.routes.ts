import { Router } from 'express';
import * as ctrl from '../controllers/agentes-financeiros.controller.js';

const router = Router();

router.get('/', ctrl.getAgentes);
router.get('/alertas', ctrl.getAlertas);
router.get('/:type/log', ctrl.getAgenteLog);
router.post('/:type/configurar', ctrl.postConfigurar);
router.post('/:type/executar', ctrl.postExecutar);
router.post('/alertas/:id/resolver', ctrl.postResolver);
router.post('/alertas/:id/ignorar', ctrl.postIgnorar);

export default router;
