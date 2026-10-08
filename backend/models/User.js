const mongoose = require('mongoose');

const cvSchema = new mongoose.Schema(
  {
    fileName: { type: String, trim: true },
    fileType: { type: String, trim: true },
    fileSize: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now },
    file: { type: String },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    username: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
    role: {
      type: String,
      enum: ['super_admin', 'admin', 'shop_owner', 'job_seeker', 'chamber_member', 'public'],
      default: 'public',
      required: true,
    },
    permissions: {
      dashboard: { type: Boolean, default: true },
      chamberMembership: { type: Boolean, default: false },
      chamberApprovals: { type: Boolean, default: false },
      chamberDocuments: { type: Boolean, default: false },
      qrCodes: { type: Boolean, default: false },
      jobs: { type: Boolean, default: false },
      jobApprovals: { type: Boolean, default: false },
      jobApplications: { type: Boolean, default: false },
      businesses: { type: Boolean, default: false },
      businessApprovals: { type: Boolean, default: false },
      news: { type: Boolean, default: false },
      advertisements: { type: Boolean, default: false },
      offers: { type: Boolean, default: false },
      users: { type: Boolean, default: false },
      reports: { type: Boolean, default: false },
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended', 'rejected'],
      default: 'pending',
      required: true,
    },
    isActive: { type: Boolean, default: true },
    location: { type: String, trim: true },
    bio: { type: String, trim: true },
    education: { type: String, trim: true },
    experience: { type: String, trim: true },
    skills: [{ type: String, trim: true }],
    dateOfBirth: { type: Date },
    cv: { type: cvSchema },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('User', userSchema);
