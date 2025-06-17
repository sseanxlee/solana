import { Router } from 'express';
import { getNonce, signIn } from '../middleware/auth';

const router = Router();

// GET /auth/nonce - Get nonce for wallet authentication
router.get('/nonce', getNonce);

// POST /auth/signin - Sign in with wallet signature
router.post('/signin', signIn);

export default router; 