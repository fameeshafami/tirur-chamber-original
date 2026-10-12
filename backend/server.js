require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const superAdminRoutes = require('./routes/superAdmin');
const businessRoutes = require('./routes/businesses');
const shopOwnerRoutes = require('./routes/shopOwner');
const jobSeekerRoutes = require('./routes/jobSeeker');
const jobRoutes = require('./routes/jobs');
const publicRoutes = require('./routes/public');
const chamberMemberRoutes = require('./routes/chamberMember');
const newsRoutes = require('./routes/news');
const offerRoutes = require('./routes/offers');
const resumeRoutes = require('./routes/resumes');
const communityUpdatesRoutes = require('./routes/communityUpdates');
const { UPLOAD_DIRECTORY } = require('./services/linkedImage');

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';
let databaseReady = false;

// Allowed frontend origins. CORS_ORIGIN is a comma-separated list, used in production.
const configuredOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = [
  'https://tirur.osforh.com',
  'https://www.tirur.osforh.com',
  'https://app.osforh.com',
  'https://tirur-connect-main.onrender.com',
  'https://indigo-lion-193760.hostingersite.com',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:3004',
  'http://127.0.0.1:3004',
  ...configuredOrigins,
];

// CORS Configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (such as mobile apps, Postman, curl, or same-origin server requests)
      if (!origin) return callback(null, true);

      // In development or if explicitly in the allowlist
      if (process.env.NODE_ENV !== 'production' || ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body parser
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));
app.use('/api/public/uploads', express.static(UPLOAD_DIRECTORY, { maxAge: '1y', immutable: true }));

// Avoid database buffering timeouts while MongoDB is unavailable.
app.use((req, res, next) => {
  const mongoConfigured = !!process.env.MONGODB_URI && process.env.MONGODB_URI !== 'your_mongodb_connection_string';
  if (req.path.startsWith('/api') && (mongoose.connection.readyState !== 1 || !databaseReady)) {
    return res.status(503).json({
      message: mongoConfigured
        ? 'Database is not connected. Ensure MongoDB is running, then retry.'
        : 'Database is not configured. Add a valid MongoDB connection string to backend/.env to enable this API.',
    });
  }
  next();
});

// Root / Health check routes
app.get('/', (req, res) => {
  res.json({ message: 'Tirur Connect API is running' });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Route registration
app.use('/api/auth', authRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/shop-owner', shopOwnerRoutes);
app.use('/api/job-seeker', jobSeekerRoutes);
app.use('/api/jobs', jobRoutes);
// Public routes — single mount point (removed duplicate /api/chamber that caused confusion)
app.use('/api/public', publicRoutes);
app.use('/api/chamber-member', chamberMemberRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/community-updates', communityUpdatesRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  if (err.message && err.message.startsWith('CORS blocked')) {
    return res.status(403).json({ message: err.message });
  }
  if (err.name === 'CastError' || err.name === 'ValidationError' || err.statusCode === 400) {
    return res.status(400).json({ message: err.statusCode === 400 ? err.message : 'Invalid request.' });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: 'A record with the same unique value already exists.' });
  }
  console.error('Server error:', err);
  return res.status(err.statusCode || 500).json({
    message: err.statusCode === 404 ? err.message : 'Something went wrong on the server.',
  });
});

// Start HTTP server immediately so the process is always reachable,
// then connect to MongoDB in the background.
const server = app.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `Port ${PORT} is already in use. Stop the existing process or change PORT in backend/.env.`
    );
  } else {
    console.error('Server error:', error.message);
  }
  process.exit(1);
});

// Connect to MongoDB asynchronously (non-blocking)
connectDB().then((conn) => {
  if (conn) {
    databaseReady = true;
    console.log('MongoDB connected successfully.');
  } else {
    console.warn(
      'MongoDB is NOT connected. API routes requiring the database will return 503 until a connection is established.'
    );
  }
});
