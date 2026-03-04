import { Router } from 'express';
import * as TransactionsController from '../controllers/transactions.controller.js';
import * as CustomersController from '../controllers/customers.controller.js';
const router = Router();
router.get('/transactions', TransactionsController.listTransactions);
router.get('/customers', CustomersController.listCustomers);
export default router;
//# sourceMappingURL=data.routes.js.map