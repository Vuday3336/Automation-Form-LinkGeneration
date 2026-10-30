import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import * as auth from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { loginBody, registerBody, changePasswordBody } from '../validators/authValidator.js';

const router = Router();

// Brute-force protection: 10 login attempts per 15 minutes per IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 1000 : 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes' },
});

router.post('/login', loginLimiter, validate({ body: loginBody }), auth.login);
router.post('/logout', auth.logout);
router.get('/me', requireAuth, auth.me);
router.post('/register', requireAuth, requirePermission('manageUsers'), validate({ body: registerBody }), auth.register);
router.patch('/password', requireAuth, validate({ body: changePasswordBody }), auth.changePassword);

export default router;
