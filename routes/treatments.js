import { Router } from 'express';
import mongoose from 'mongoose';
import Treatment from '../models/Treatment.js';
import { getPublicAdminRecords } from './admin.js';
import { treatmentDefaults } from '../utils/bootstrapDefaults.js';
import { classifyIcdCategory } from '../utils/icd11.js';

const router = Router();

function normalizeTreatmentRecord(item) {
  const group = item.group || item.category || item.specialty || item.subtitle || '';
  const isGenericLabel = !group || /^icd-?11/i.test(group) || group === 'ICD-11 MMS';
  if (isGenericLabel) {
    const classified = classifyIcdCategory({
      code: item.icdCode || item.procedureCode || item.code || '',
      title: item.title || '',
    });
    return {
      ...item,
      group: classified.group,
      category: classified.category,
      specialty: classified.specialty,
    };
  }
  return item;
}

router.get('/categories', async (_req, res, next) => {
  try {
    let treatments = [];

    if (mongoose.connection.readyState !== 1) {
      treatments = treatmentDefaults().map((item, index) => ({
        ...normalizeTreatmentRecord(item),
        _id: `default-treatment-${index + 1}`,
      }));
    } else {
      const [dbTreatments, adminTreatmentRecords] = await Promise.all([
        Treatment.find({ active: true }).sort({ createdAt: 1 }).lean(),
        getPublicAdminRecords('treatment'),
      ]);

      const adminTreatments = adminTreatmentRecords
        .filter((record) => record.status !== 'Deleted' && record.status !== 'Hidden')
        .map((record) => ({
          _id: record._id,
          ...(record.publicData || {}),
          title: record.publicData?.title || record.title,
          active: record.publicData?.active !== false,
          adminRecordId: record._id,
        }))
        .filter((item) => item.active)
        .map(normalizeTreatmentRecord);

      const dbNormalized = dbTreatments.map(normalizeTreatmentRecord);

      const seen = new Set();
      treatments = [...adminTreatments, ...dbNormalized].filter((item) => {
        const key = String(item.icdUri || item.icdCode || item.title || item._id).toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (treatments.length === 0) {
        treatments = treatmentDefaults().map((item, index) => ({
          ...normalizeTreatmentRecord(item),
          _id: `default-treatment-${index + 1}`,
        }));
      }
    }

    const categories = [...new Set(
      treatments
        .map((t) => t.group || t.category || t.specialty)
        .filter(Boolean)
    )].sort();

    res.json(categories);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (_req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const defaults = treatmentDefaults().map((item, index) => ({
        ...normalizeTreatmentRecord(item),
        _id: `default-treatment-${index + 1}`,
      }));
      return res.json(defaults);
    }

    const [treatments, adminTreatmentRecords] = await Promise.all([
      Treatment.find({ active: true }).sort({ createdAt: 1 }).lean(),
      getPublicAdminRecords('treatment'),
    ]);

    const adminTreatments = adminTreatmentRecords
      .filter((record) => record.status !== 'Deleted' && record.status !== 'Hidden')
      .map((record) => ({
        _id: record._id,
        ...(record.publicData || {}),
        title: record.publicData?.title || record.title,
        active: record.publicData?.active !== false,
        adminRecordId: record._id,
      }))
      .filter((item) => item.active)
      .map(normalizeTreatmentRecord);

    const dbTreatments = treatments.map(normalizeTreatmentRecord);

    const seen = new Set();
    let merged = [...adminTreatments, ...dbTreatments].filter((item) => {
      const key = String(item.icdUri || item.icdCode || item.title || item._id).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (merged.length === 0) {
      const defaults = treatmentDefaults().map((item, index) => ({
        ...normalizeTreatmentRecord(item),
        _id: `default-treatment-${index + 1}`,
      }));
      return res.json(defaults);
    }

    res.json(merged);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (mongoose.Types.ObjectId.isValid(id)) {
      const treatment = await Treatment.findById(id);
      if (treatment) return res.json(treatment);
    }

    if (mongoose.connection.readyState !== 1) {
      const defaults = treatmentDefaults().map((item, index) => ({
        ...normalizeTreatmentRecord(item),
        _id: `default-treatment-${index + 1}`,
      }));
      const match = defaults.find((item) => item._id === id || item.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-') === id);
      if (match) return res.json(match);
    }

    const adminTreatmentRecords = await getPublicAdminRecords('treatment');
    const match = adminTreatmentRecords.find((record) => {
      const data = record.publicData || {};
      const slugified = (data.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      return slugified === id || String(record._id) === id;
    });
    if (match) {
      return res.json({ _id: match._id, ...(match.publicData || {}), title: match.publicData?.title || match.title });
    }

    res.status(404).json({ message: 'Treatment not found' });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const treatment = await Treatment.create(req.body);
    res.status(201).json(treatment);
  } catch (error) {
    next(error);
  }
});

export default router;
