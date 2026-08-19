import mongoose from 'mongoose';

export const patientDb = mongoose.createConnection();

export async function connectDB() {
  const publicUri = process.env.MONGO_PUBLIC_URI || process.env.MONGO_URI;
  const patientUri = process.env.MONGO_PATIENT_URI || process.env.MONGO_URI;

  if (!publicUri) {
    throw new Error('MONGO_PUBLIC_URI or MONGO_URI is required');
  }

  mongoose.set('bufferCommands', false);

  await mongoose.connect(publicUri, {
    serverSelectionTimeoutMS: 4000,
    connectTimeoutMS: 4000,
  });
  console.log('Public MongoDB connected');

  if (!patientUri) {
    console.warn('MONGO_PATIENT_URI is not configured. Patient records will use in-memory fallback only.');
    return;
  }

  try {
    await patientDb.openUri(patientUri);
    console.log('Patient records MongoDB connected');
  } catch (error) {
    console.error('Patient records MongoDB connection failed. Patient records will use in-memory fallback.', error.message);
  }
}

export function isPublicDbConnected() {
  return mongoose.connection.readyState === 1;
}

export function isPatientDbConnected() {
  return patientDb.readyState === 1;
}
