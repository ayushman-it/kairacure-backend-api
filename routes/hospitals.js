import { Router } from 'express';
import mongoose from 'mongoose';
import Hospital from '../models/Hospital.js';
import { getPublicAdminRecords } from './admin.js';
import { hospitalDefaults } from '../utils/bootstrapDefaults.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const adminHospitalRecords = await getPublicAdminRecords('hospital');
    if (adminHospitalRecords.length) {
      const masterDataRecords = adminHospitalRecords.filter((record) => /client|jci/i.test(record.publicData?.sourceSystem || ''));
      const sourceRecords = masterDataRecords.length
        ? masterDataRecords
        : hospitalDefaults().map((item, index) => ({
          publicData: item,
          _id: `client-master-hospital-${index + 1}`,
          status: item.status || 'Active',
          updatedAt: item.updatedAt,
        }));
      return res.json(sourceRecords.map((record) => ({
        ...record.publicData,
        _id: record._id,
        status: record.status,
        updatedAt: record.updatedAt,
      })));
    }

    if (mongoose.connection.readyState !== 1) {
      return res.json(hospitalDefaults().map((item, index) => ({ ...item, _id: `default-hospital-${index + 1}` })));
    }
    const hospitals = await Hospital.find({ active: true }).sort({ createdAt: 1 });
    res.json(hospitals);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const hospital = await Hospital.create(req.body);
    res.status(201).json(hospital);
  } catch (error) {
    next(error);
  }
});

export default router;
