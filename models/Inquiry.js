import mongoose from 'mongoose';

function stripHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>/g, '');
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inquirySchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 200 },
    phone: { type: String, trim: true, maxlength: 20 },
    email: { type: String, trim: true, maxlength: 254, lowercase: true },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    intent: { type: String, default: 'patient', enum: ['patient', 'partner', 'general'] },
  },
  { timestamps: true },
);

inquirySchema.pre('validate', function (next) {
  if (this.email && !emailRegex.test(this.email)) {
    this.invalidate('email', 'Invalid email format');
  }
  next();
});

inquirySchema.pre('save', function (next) {
  if (this.name) this.name = stripHtml(this.name);
  if (this.message) this.message = stripHtml(this.message);
  if (this.phone) this.phone = stripHtml(this.phone);
  next();
});

export default mongoose.model('Inquiry', inquirySchema);
