const mongoose = require('mongoose');
const User = require('../models/User');
const HeroSlide = require('../models/HeroSlide');

let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri || mongoUri === 'your_mongodb_connection_string') {
    console.warn('MONGODB_URI is not configured. Add a valid MongoDB connection string to backend/.env');
    return null;
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(mongoUri, {
        serverSelectionTimeoutMS: 5000,
        maxPoolSize: 10,
      })
      .then((mongooseInstance) => {
        console.log('MongoDB connected');
        return mongooseInstance;
      });
  }

  try {
    cached.conn = await cached.promise;
    await User.collection.updateMany(
      {
        role: 'admin',
        $or: [
          { 'permissions.chamberMembers': { $exists: true } },
          { 'permissions.applications': { $exists: true } },
          { 'permissions.communityUpdates': { $exists: true } },
          { 'permissions.ads': { $exists: true } },
          { 'permissions.adminManagement': { $exists: true } },
        ],
      },
      {
        $set: {
          'permissions.dashboard': true,
          'permissions.chamberMembership': false,
          'permissions.chamberApprovals': false,
          'permissions.chamberDocuments': false,
          'permissions.qrCodes': false,
          'permissions.jobs': false,
          'permissions.jobApprovals': false,
          'permissions.jobApplications': false,
          'permissions.businesses': false,
          'permissions.businessApprovals': false,
          'permissions.news': false,
          'permissions.advertisements': false,
          'permissions.offers': false,
          'permissions.users': false,
          'permissions.reports': false,
        },
        $unset: {
          'permissions.chamberMembers': '',
          'permissions.applications': '',
          'permissions.communityUpdates': '',
          'permissions.ads': '',
          'permissions.adminManagement': '',
        },
      },
    );
    await User.collection.updateMany({ role: 'admin', status: 'active' }, { $set: { isActive: true } });
    await User.collection.updateMany({ role: 'admin', status: { $ne: 'active' } }, { $set: { isActive: false } });
    await HeroSlide.collection.updateMany(
      { show_text: { $exists: false } },
      { $set: { show_text: false } },
    );
    await HeroSlide.collection.updateMany(
      { active: { $exists: false } },
      { $set: { active: true } },
    );
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    console.error('MongoDB connection error:', error.message);
    if (mongoose.connection.readyState === 1) await mongoose.disconnect();
    cached.conn = null;
    // Do NOT exit — the server 503 guard in server.js will block API
    // routes when the DB is unavailable, keeping the process alive.
    return null;
  }
};

module.exports = connectDB;
