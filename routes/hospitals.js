import { Router } from 'express';
import mongoose from 'mongoose';
import Hospital from '../models/Hospital.js';
import { getPublicAdminRecords } from './admin.js';
import { hospitalDefaults } from '../utils/bootstrapDefaults.js';

const router = Router();

function matchesSearch(record, search) {
  if (!search) return true;
  const q = search.toLowerCase();
  const name = (record.name || '').toLowerCase();
  const city = (record.city || '').toLowerCase();
  const specialty = (record.specialty || '').toLowerCase();
  return name.includes(q) || city.includes(q) || specialty.includes(q);
}

function matchesFilter(record, city, specialty) {
  if (city && (record.city || '').toLowerCase() !== city.toLowerCase()) return false;
  if (specialty && !(record.specialty || '').toLowerCase().includes(specialty.toLowerCase())) return false;
  return true;
}

router.get('/', async (req, res, next) => {
  try {
    const { search, city, specialty } = req.query;
    const filterHospital = (h) => matchesSearch(h, search) && matchesFilter(h, city, specialty);

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
      const mapped = sourceRecords.map((record) => ({
        ...record.publicData,
        _id: record._id,
        status: record.status,
        updatedAt: record.updatedAt,
      }));
      return res.json(mapped.filter(filterHospital));
    }

    if (mongoose.connection.readyState !== 1) {
      return res.json(
        hospitalDefaults()
          .map((item, index) => ({ ...item, _id: `default-hospital-${index + 1}` }))
          .filter(filterHospital)
      );
    }
    const hospitals = await Hospital.find({ active: true }).sort({ createdAt: 1 });
    res.json(hospitals.filter(filterHospital));
  } catch (error) {
    next(error);
  }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;

    if (mongoose.Types.ObjectId.isValid(slug)) {
      const hospital = await Hospital.findById(slug);
      if (hospital) return res.json(hospital);
    }

    const adminHospitalRecords = await getPublicAdminRecords('hospital');
    const match = adminHospitalRecords.find((record) => {
      const data = record.publicData || {};
      const slugified = (data.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      return slugified === slug || String(record._id) === slug || String(data.id) === slug;
    });
    if (match) {
      return res.json({ ...match.publicData, _id: match._id, status: match.status });
    }

    if (mongoose.connection.readyState !== 1) {
      const defaults = hospitalDefaults().map((item, index) => ({ ...item, _id: `default-hospital-${index + 1}` }));
      const defaultMatch = defaults.find((item) => {
        const slugified = (item.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        return slugified === slug || item._id === slug;
      });
      if (defaultMatch) return res.json(defaultMatch);
    }

    res.status(404).json({ message: 'Hospital not found' });
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
