import mongoose from 'mongoose';

export const patientDb = mongoose.createConnection();

let retryTimer = null;

export async function connectDB(onConnectSuccess) {
  const publicUri = process.env.MONGO_PUBLIC_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kairacure';
  const patientUri = process.env.MONGO_PATIENT_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kairacure';

  mongoose.set('bufferCommands', false);

  try {
    await mongoose.connect(publicUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    console.log('Public MongoDB connected successfully');

    if (patientUri) {
      try {
        await patientDb.openUri(patientUri);
        console.log('Patient records MongoDB connected');
      } catch (error) {
        console.warn('Patient records MongoDB connection failed. Trying local fallback...');
        try {
          await patientDb.openUri('mongodb://127.0.0.1:27017/kairacure_patient_records');
          console.log('Local Patient records MongoDB connected as fallback');
        } catch (lErr) {
          console.warn('Patient records secondary DB offline.');
        }
      }
    }

    if (retryTimer) {
      clearInterval(retryTimer);
      retryTimer = null;
    }

    if (typeof onConnectSuccess === 'function') {
      await onConnectSuccess();
    }
    return true;
  } catch (err) {
    console.warn('MongoDB Atlas connection failed. Trying local MongoDB fallback (mongodb://127.0.0.1:27017/kairacure)...');
    try {
      await mongoose.connect('mongodb://127.0.0.1:27017/kairacure', {
        serverSelectionTimeoutMS: 3000,
        connectTimeoutMS: 3000,
      });
      console.log('Local MongoDB connected successfully as fallback!');
      if (typeof onConnectSuccess === 'function') {
        await onConnectSuccess();
      }
      return true;
    } catch (localErr) {
      console.warn('Primary MongoDB Atlas connection failed:', err.message);
      console.warn('\n------------------------------------------------------------');
      console.warn('📌 MONGODB ATLAS IP WHITELIST INSTRUCTION:');
      console.warn('1. Open https://cloud.mongodb.com and log in.');
      console.warn('2. Click "Security" -> "Network Access" -> "+ Add IP Address".');
      console.warn('3. Click "ALLOW ACCESS FROM ANYWHERE" (0.0.0.0/0) and click Confirm.');
      console.warn('4. API is running smoothly. Retrying MongoDB connection in background...');
      console.warn('------------------------------------------------------------\n');

      if (!retryTimer) {
        retryTimer = setInterval(async () => {
          if (mongoose.connection.readyState !== 1) {
            console.log('Retrying MongoDB Atlas connection...');
            try {
              await mongoose.connect(publicUri, {
                serverSelectionTimeoutMS: 5000,
                connectTimeoutMS: 5000,
              });
              console.log('MongoDB Atlas reconnected successfully!');
              clearInterval(retryTimer);
              retryTimer = null;
              if (typeof onConnectSuccess === 'function') {
                await onConnectSuccess();
              }
            } catch (rErr) {
              // silent retry
            }
          }
        }, 15000);
      }
      return false;
    }
  }
}

export function isPublicDbConnected() {
  return mongoose.connection.readyState === 1;
}

export function isPatientDbConnected() {
  return patientDb.readyState === 1;
}
