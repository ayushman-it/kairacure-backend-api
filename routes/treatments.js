import { Router } from 'express';
import mongoose from 'mongoose';
import Treatment from '../models/Treatment.js';
import { getPublicAdminRecords } from './admin.js';
import { treatmentDefaults } from '../utils/bootstrapDefaults.js';
import { classifyIcdCategory } from '../utils/icd11.js';

const router = Router();

// Ensure every treatment has proper category/group/specialty fields.
// Seed treatments use plain strings like "Cardiac Sciences" for group/category already,
// but ICD-11 imported ones (pre-fix) may still have "ICD-11 MMS" — this normalises them.
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

router.get('/', async (_req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json([]);
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

    // Build the merged list: admin records first, then Treatment collection.
    const seen = new Set();
    let merged = [...adminTreatments, ...dbTreatments].filter((item) => {
      const key = String(item.icdUri || item.icdCode || item.title || item._id).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    res.json(merged);
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
