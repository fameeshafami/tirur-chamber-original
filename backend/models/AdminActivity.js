const mongoose = require('mongoose');

const adminActivitySchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  adminName: { type: String, required: true, trim: true },
  section: { type: String, required: true, trim: true },
  action: { type: String, required: true, trim: true },
  targetId: { type: String, default: '' },
  targetType: { type: String, default: '' },
  description: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now, index: true },
  status: { type: String, enum: ['completed', 'failed'], required: true },
});

adminActivitySchema.index({ adminId:  1, timestamp: -1 });

module.exports = mongoose.model('AdminActivity', adminActivitySchema);