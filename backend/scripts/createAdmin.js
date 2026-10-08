require('dotenv').config();

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 12;

const requiredEnvironmentValues = ['ADMIN_NAME', 'ADMIN_EMAIL', 'ADMIN_PHONE', 'ADMIN_PASSWORD'];

const validateEnvironment = () => {
  const missingValues = requiredEnvironmentValues.filter((key) => !process.env[key]?.trim());

  if (missingValues.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missingValues.join(', ')}`);
  }

  if (!EMAIL_PATTERN.test(process.env.ADMIN_EMAIL.trim())) {
    throw new Error('ADMIN_EMAIL is not a valid email address.');
  }

  if (process.env.ADMIN_PASSWORD.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }

  if (!process.env.MONGODB_URI || process.env.MONGODB_URI === 'your_mongodb_connection_string') {
    throw new Error('MONGODB_URI is not configured with a real MongoDB connection string.');
  }
}

const createAdmin = async () => {
  validateEnvironment();

  await mongoose.connect(process.env.MONGODB_URI);

  const existingSuperAdmin = await User.findOne({ role: 'super_admin' }).select('_id');
  if (existingSuperAdmin) {
    console.log('A Super Admin account already exists. No account was changed.');
    return;
  }

  const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
  const existingAccount = await User.findOne({ email }).select('+passwordHash');
  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
  const permissions = {
    dashboard: true,
    chamberMembership: true,
    chamberApprovals: true,
    chamberDocuments: true,
    qrCodes: true,
    jobs: true,
    jobApprovals: true,
    jobApplications: true,
    businesses: true,
    businessApprovals: true,
    news: true,
    advertisements: true,
    offers: true,
    users: true,
    reports: true,
  };

  if (existingAccount && !['admin', 'super_admin'].includes(existingAccount.role)) {
    throw new Error('ADMIN_EMAIL belongs to a non-admin account. Choose an unused email or an existing admin email.');
  }

  if (existingAccount) {
    existingAccount.name = process.env.ADMIN_NAME.trim();
    existingAccount.phone = process.env.ADMIN_PHONE.trim();
    existingAccount.passwordHash = passwordHash;
    existingAccount.role = 'super_admin';
    existingAccount.status = 'active';
    existingAccount.isActive = true;
    existingAccount.permissions = permissions;
    await existingAccount.save();
  } else {
    await User.create({
      name: process.env.ADMIN_NAME.trim(),
      email,
      phone: process.env.ADMIN_PHONE.trim(),
      passwordHash,
      role: 'super_admin',
      status: 'active',
      isActive: true,
      permissions,
    });
  }

  console.log('Super Admin account provisioned successfully.');
};

createAdmin()
  .catch((error) => {
    console.error(`Admin creation failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });
