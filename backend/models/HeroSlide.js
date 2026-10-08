const mongoose = require('mongoose');

const heroSlideSchema = new mongoose.Schema(
  {
    desktopImage: { type: String, default: '' },
    image_source: { type: String, enum: ['upload', 'url'], default: 'upload' },
    image_url: { type: String, trim: true, default: '' },
    wideImage: { type: String, default: '' },
    wide_image_source: { type: String, enum: ['upload', 'url'], default: 'upload' },
    wide_image_url: { type: String, trim: true, default: '' },
    mobileImage: { type: String, default: '' },
    mobile_image_source: { type: String, enum: ['upload', 'url'], default: 'upload' },
    mobile_image_url: { type: String, trim: true, default: '' },
    altText: { type: String, required: true, trim: true },
    show_text: { type: Boolean, default: false },
    title: { type: String, trim: true, maxlength: 80, default: null },
    description: { type: String, trim: true, maxlength: 160, default: null },
    subtitle: { type: String, trim: true, default: '' },
    buttonText: { type: String, trim: true, default: '' },
    buttonLink: { type: String, trim: true, default: '' },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: false, index: true },
    startDate: { type: Date },
    endDate: { type: Date },
  },
  { timestamps: true }
);

heroSlideSchema.index({ active: 1, startDate: 1, endDate: 1, order: 1 });

module.exports = mongoose.model('HeroSlide', heroSlideSchema);
