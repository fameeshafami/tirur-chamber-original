const mongoose = require('mongoose');

const CATEGORY_ICONS = {
  shops_joined: '🏪',
  hirings: '💼',
  active_members: '🏆',
  ad_slots: '📢',
  events: '🎉',
  announcements: '📰',
  offers: '🛒',
  general: '📌',
};

const communityUpdateSchema = new mongoose.Schema(
  {
    category: { type: String, required: true, trim: true, lowercase: true, maxlength: 64 },
    text: { type: String, required: true, trim: true, maxlength: 500 },
    icon: { type: String, trim: true, maxlength: 16 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
    startAt: { type: Date },
    endAt: { type: Date },
  },
  { timestamps: true }
);

communityUpdateSchema.index({ status: 1, createdAt: -1 });
communityUpdateSchema.index({ category: 1, status: 1 });
communityUpdateSchema.pre('validate', function setDefaultIcon() {
  if (!this.icon) this.icon = CATEGORY_ICONS[this.category] || CATEGORY_ICONS.general;
});

module.exports = mongoose.model('CommunityUpdate', communityUpdateSchema);