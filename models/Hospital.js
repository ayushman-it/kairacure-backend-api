import mongoose from 'mongoose';

const hospitalSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    summary: { type: String, trim: true },
    country: { type: String, default: 'India', trim: true },
    state: { type: String, trim: true },
    specialty: { type: String, trim: true },
    treatments: { type: String, trim: true },
    tags: [{ type: String, trim: true }],
    accreditations: { type: String, trim: true },
    packageFrom: { type: Number, default: 0 },
    beds: { type: Number, default: 0 },
    rating: { type: Number, default: 4.8 },
    doctor: { type: String, trim: true },
    doctorTitle: { type: String, trim: true },
    doctorImage: { type: String, trim: true },
    galleryImages: [{ type: String, trim: true }],
    patientReviews: [{ type: mongoose.Schema.Types.Mixed }],
    image: { type: String, trim: true },
    active: { type: Boolean, default: true },
  },
  { strict: false, timestamps: true },
);

export default mongoose.model('Hospital', hospitalSchema);
