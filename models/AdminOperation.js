import mongoose from 'mongoose';

const encryptedPayloadSchema = new mongoose.Schema(
  {
    algorithm: { type: String, required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true },
    ciphertext: { type: String, required: true },
  },
  { _id: false },
);

const adminOperationSchema = new mongoose.Schema(
  {
    recordType: {
      type: String,
      enum: ['hospital', 'treatment', 'surgery', 'doctor', 'agent', 'consultationStage', 'inquiry', 'appointment', 'patientRecord', 'accreditationType', 'import', 'siteSetting', 'page', 'journeyPlan'],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    status: { type: String, default: 'draft', trim: true, index: true },
    publicData: { type: mongoose.Schema.Types.Mixed, default: {} },
    encryptedPrivateData: { type: encryptedPayloadSchema, required: true },
    createdBy: { type: String, default: 'admin', trim: true },
  },
  { timestamps: true },
);

export default mongoose.model('AdminOperation', adminOperationSchema);
