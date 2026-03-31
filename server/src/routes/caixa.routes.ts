import { Router } from 'express';
import * as ctrl from '../controllers/financeiro.controller.js';

const router = Router();

router.get('/posicao', ctrl.getCaixaPosicao);
router.get('/forecast', ctrl.getCaixaForecast);
router.get('/entradas-saidas', ctrl.getCaixaEntradasSaidas);
router.get('/runway', ctrl.getCaixaRunway);

export default router;
