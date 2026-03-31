import { Router } from 'express';
import * as ctrl from '../controllers/financeiro.controller.js';

const router = Router();

router.get('/', ctrl.getFornecedores);
router.get('/:id', ctrl.getFornecedorDetalhe);
router.get('/:id/roi', ctrl.getFornecedorROI);
router.post('/', ctrl.createFornecedor);
router.patch('/:id', ctrl.updateFornecedor);
router.delete('/:id', ctrl.deleteFornecedor);

export default router;
