import mongoose from 'mongoose';

const inquirySchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
    message: { type: String, required: true, trim: true },
    intent: { type: String, default: 'patient', enum: ['patient', 'partner', 'general'] },
  },
  { timestamps: true },
);

export default mongoose.model('Inquiry', inquirySchema);
