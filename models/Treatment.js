import mongoose from 'mongoose';

const treatmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    image: { type: String, trim: true },
    group: { type: String, trim: true },
    specialty: { type: String, trim: true },
    packageFrom: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { strict: false, timestamps: true },
);

export default mongoose.model('Treatment', treatmentSchema);
