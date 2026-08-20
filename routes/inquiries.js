import { Router } from 'express';
import Inquiry from '../models/Inquiry.js';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const inquiry = await Inquiry.create(req.body);
    res.status(201).json({ message: 'Inquiry submitted', inquiry });
  } catch (error) {
    next(error);
  }
});

export default router;
