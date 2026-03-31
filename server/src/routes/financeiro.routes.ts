import { Router } from 'express';
import * as ctrl from '../controllers/financeiro.controller.js';

const router = Router();

// P&L e extrato
router.get('/pl', ctrl.getPL);
router.get('/extrato', ctrl.getExtrato);
router.get('/export', ctrl.exportCSV);

// Gastos fixos CRUD
router.get('/gastos-fixos', ctrl.listGastosFixos);
router.post('/gastos-fixos', ctrl.createGastoFixo);
router.patch('/gastos-fixos/:id', ctrl.updateGastoFixo);
router.delete('/gastos-fixos/:id', ctrl.deleteGastoFixo);

export default router;
