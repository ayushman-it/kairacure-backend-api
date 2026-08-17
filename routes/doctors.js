import { Router } from 'express';
import mongoose from 'mongoose';
import Doctor from '../models/Doctor.js';
import { doctorDefaults } from '../utils/bootstrapDefaults.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { treatment, city, hospital } = req.query;
    if (mongoose.connection.readyState !== 1) {
      const doctors = doctorDefaults();
      return res.json(doctors.map((item, index) => ({ ...item, _id: `default-doctor-${index + 1}` })));
    }

    const filter = { active: true };

    if (treatment) filter.treatments = treatment;
    if (city) filter.city = city;
    if (hospital) filter.hospital = hospital;

    const doctors = await Doctor.find(filter).sort({ createdAt: 1 });
    res.json(doctors);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const doctor = await Doctor.create(req.body);
    res.status(201).json(doctor);
  } catch (error) {
    next(error);
  }
});

export default router;
