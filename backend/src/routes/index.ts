import { Router } from 'express';
import authRoutes from './authRoutes';
import tenantRoutes from './tenantRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/tenants', tenantRoutes);

export default router;
