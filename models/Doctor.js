import mongoose from 'mongoose';

const doctorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    hospital: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    specialty: { type: String, required: true, trim: true },
    experience: { type: String, required: true, trim: true },
    rating: { type: Number, default: 4.8 },
    image: { type: String, trim: true },
    profileImage: { type: String, trim: true },
    about: { type: String, trim: true },
    consultationFee: { type: Number, default: 0 },
    treatments: [{ type: String, trim: true }],
    focusAreas: [{ type: String, trim: true }],
    education: [{ type: String, trim: true }],
    reviews: [{ type: mongoose.Schema.Types.Mixed }],
    active: { type: Boolean, default: true },
  },
  { strict: false, timestamps: true },
);

export default mongoose.model('Doctor', doctorSchema);
