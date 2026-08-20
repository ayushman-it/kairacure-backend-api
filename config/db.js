import mongoose from 'mongoose';

export const patientDb = mongoose.createConnection();

export async function connectDB() {
  const publicUri = process.env.MONGO_PUBLIC_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kairacure';
  const patientUri = process.env.MONGO_PATIENT_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kairacure';

  mongoose.set('bufferCommands', false);

  try {
    await mongoose.connect(publicUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    console.log('Public MongoDB connected successfully');
  } catch (err) {
    console.warn('MongoDB Atlas connection failed. Trying local MongoDB fallback (mongodb://127.0.0.1:27017/kairacure)...');
    try {
      await mongoose.connect('mongodb://127.0.0.1:27017/kairacure', {
        serverSelectionTimeoutMS: 3000,
        connectTimeoutMS: 3000,
      });
      console.log('Local MongoDB connected successfully as fallback!');
    } catch (localErr) {
      console.error('Primary MongoDB Atlas connection failed:', err.message);
      console.error('\n------------------------------------------------------------');
      console.error('📌 HOW TO FIX MONGODB ATLAS CONNECTION (2 SIMPLE STEPS):');
      console.error('1. Go to https://cloud.mongodb.com and open your MongoDB Atlas Cluster.');
      console.error('2. Go to "Security" -> "Network Access" -> Click "+ Add IP Address".');
      console.error('3. Click "ALLOW ACCESS FROM ANYWHERE" (0.0.0.0/0) and click Confirm.');
      console.error('4. Re-run: node --watch index.js');
      console.error('------------------------------------------------------------\n');
      throw err;
    }
  }

  if (!patientUri) {
    console.warn('MONGO_PATIENT_URI is not configured. Patient records will use primary DB fallback.');
    return;
  }

  try {
    await patientDb.openUri(patientUri);
    console.log('Patient records MongoDB connected');
  } catch (error) {
    console.warn('Patient records MongoDB connection failed. Trying local fallback...');
    try {
      await patientDb.openUri('mongodb://127.0.0.1:27017/kairacure_patient_records');
      console.log('Local Patient records MongoDB connected as fallback');
    } catch (lErr) {
      console.error('Patient records fallback failed:', error.message);
    }
  }
}

export function isPublicDbConnected() {
  return mongoose.connection.readyState === 1;
}

export function isPatientDbConnected() {
  return patientDb.readyState === 1;
}
