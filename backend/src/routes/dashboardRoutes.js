import { Router } from 'express';
import * as dashboard from '../controllers/dashboardController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);
router.get('/stats', dashboard.stats);
router.get('/recent-submissions', dashboard.recentSubmissions);
router.get('/department-stats', dashboard.departmentStats);

export default router;
