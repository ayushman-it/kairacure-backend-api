import { Router } from 'express';
import Inquiry from '../models/Inquiry.js';

const router = Router();

function stripHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>/g, '').trim();
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/', async (req, res, next) => {
  try {
    const { name, phone, email, message, intent } = req.body || {};

    if (!message || !String(message).trim()) {
      return res.status(400).json({ message: 'message is required' });
    }

    if (email && !emailRegex.test(String(email).trim())) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    if (name && stripHtml(String(name)).length > 200) {
      return res.status(400).json({ message: 'name must be 200 characters or less' });
    }
    if (message && stripHtml(String(message)).length > 5000) {
      return res.status(400).json({ message: 'message must be 5000 characters or less' });
    }
    if (email && String(email).length > 254) {
      return res.status(400).json({ message: 'email must be 254 characters or less' });
    }

    const inquiry = await Inquiry.create({
      name: name ? stripHtml(String(name)) : undefined,
      phone: phone ? stripHtml(String(phone)) : undefined,
      email: email ? String(email).trim().toLowerCase() : undefined,
      message: stripHtml(String(message)),
      intent: intent || 'patient',
    });
    res.status(201).json({ message: 'Inquiry submitted', inquiry });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    next(error);
  }
});

export default router;
