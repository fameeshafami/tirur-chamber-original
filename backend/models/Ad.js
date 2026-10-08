const mongoose = require('mongoose');

const normalizeSide = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'left' || normalized === 'sidebar-left') return 'left';
  if (normalized === 'right' || normalized === 'sidebar-right') return 'right';
  if (normalized === 'directory') return 'directory';
  return 'homepage';
};

const normalizePlacement = (value) => {
  const side = normalizeSide(value);
  return side === 'left' ? 'sidebar-left' : side === 'right' ? 'sidebar-right' : side;
};

const adSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true },
    adTitle:     { type: String, trim: true, maxlength: 60, default: null },
    subtitle:    { type: String, trim: true },
    description: { type: String, trim: true, maxlength: 120, default: null },
    content:     { type: String, trim: true },
    category:    { type: String, trim: true },
    badge:       { type: String, trim: true },

    // placement: existing admin field ('homepage','sidebar-left','sidebar-right','directory')
    placement: {
      type: String,
      enum: ['homepage', 'sidebar-left', 'sidebar-right', 'directory'],
      default: 'homepage',
    },

    // position: canonical query field used by the public API ('left','right','homepage','directory')
    // Derived from placement when not set directly.
    position: {
      type: String,
      enum: ['left', 'right', 'homepage', 'directory'],
      index: true,
    },
    side: {
      type: String,
      enum: ['left', 'right', 'homepage', 'directory'],
      index: true,
    },
    sideOrder: {
      type: Number,
      min: 1,
      max: 3,
      validate: { validator: (value) => value == null || Number.isInteger(value), message: 'Ad position must be a whole number.' },
      default: null,
    },

    imageUrl: { type: String, trim: true },
    image_source: { type: String, enum: ['upload', 'url'], default: 'upload' },
    image_url: { type: String, trim: true, default: '' },
    link:     { type: String, trim: true },
    approved: { type: Boolean, default: false, index: true },
    approval_status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },

    // status: 'active' is the canonical public value; 'published' kept for backward compat
    status: {
      type: String,
      enum: ['draft', 'published', 'active', 'unpublished'],
      default: 'draft',
      index: true,
    },
    enabled:   { type: Boolean, default: true },

    // Date range — support both naming conventions
    startAt:   { type: Date },           // legacy admin field
    endAt:     { type: Date },           // legacy admin field
    startDate: { type: Date },           // canonical public query field
    endDate:   { type: Date },           // canonical public query field

    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

adSchema.pre('validate', function normalizeAdSides() {
  const normalizedSide = normalizeSide(this.side || this.position || this.placement);
  this.side = normalizedSide;
  this.position = normalizedSide;
  this.placement = normalizePlacement(normalizedSide);
});

// Sync position ↔ placement and startDate/endDate ↔ startAt/endAt before save
adSchema.pre('save', function (next) {
  this.side = normalizeSide(this.side || this.position || this.placement);
  this.position = this.side;
  this.placement = normalizePlacement(this.side);
  // Sync date fields
  if (this.startAt) this.startDate = this.startAt;
  else if (this.startDate) this.startAt = this.startDate;
  if (this.endAt) this.endDate = this.endAt;
  else if (this.endDate) this.endAt = this.endDate;
  // Treat 'active' as alias for 'published'
  if (this.status === 'active') this.status = 'published';
  if (this.approved === true) this.approval_status = 'approved';
  else if (this.approval_status === 'approved') this.approved = true;
  next();
});

adSchema.index({ status: 1, enabled: 1, position: 1, startDate: 1, endDate: 1 });
adSchema.index({ status: 1, enabled: 1, placement: 1, startAt: 1, endAt: 1 });

module.exports = mongoose.model('Ad', adSchema);