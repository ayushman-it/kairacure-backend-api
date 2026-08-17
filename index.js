import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import { connectDB, isPatientDbConnected } from './config/db.js';
import adminRoutes from './routes/admin.js';
import aiAssistantRoutes from './routes/aiAssistant.js';
import hospitalRoutes from './routes/hospitals.js';
import inquiryRoutes from './routes/inquiries.js';
import patientRoutes from './routes/patients.js';
import treatmentRoutes from './routes/treatments.js';
import doctorRoutes from './routes/doctors.js';
import { bootstrapDefaults } from './utils/bootstrapDefaults.js';

const app = express();
const port = process.env.PORT || 5000;
const configuredOrigins = (process.env.CLIENT_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([
  process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5175',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:4174',
  'http://127.0.0.1:4174',
  'http://localhost:4175',
  'http://127.0.0.1:4175',
  'https://bogged-latticed-uncommon.ngrok-free.dev',
  ...configuredOrigins,
]);
const allowedOriginPatterns = [
  /^https:\/\/[a-z0-9-]+\.ngrok-free\.(dev|app)$/i,
];

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin) || allowedOriginPatterns.some((pattern) => pattern.test(origin))) return callback(null, true);
    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
}));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    databases: {
      public: mongoose.connection.readyState === 1 ? 'connected' : 'offline',
      patientRecords: isPatientDbConnected() ? 'connected' : 'offline',
    },
  });
});

app.use('/api/treatments', treatmentRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai-assistant', aiAssistantRoutes);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({ message: error.message || 'Server error' });
});

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});

connectDB()
  .then(() => bootstrapDefaults())
  .then(() => {
    console.log('Backend default hospital, doctor, treatment, admin, and patient database routes ready.');
  })
  .catch((error) => {
    console.error('MongoDB connection failed. API is still running without database-backed records.', error.message);
  });
