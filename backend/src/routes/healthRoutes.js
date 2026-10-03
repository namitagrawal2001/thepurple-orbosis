import { Router } from 'express';
import { getHealth, getLiveness, getReadiness } from '../controllers/healthController.js';

const router = Router();

router.get('/', getHealth);
router.get('/live', getLiveness);
router.get('/ready', getReadiness);

export default router;
