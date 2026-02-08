/**
 * Benefit Model
 * Mongoose schema for renewable energy benefits
 */

const mongoose = require('mongoose');

const benefitSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Benefit title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Benefit description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },
  impact: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium',
    required: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  statistics: {
    value: String,
    unit: String,
    source: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  priority: {
    type: Number,
    default: 0,
    min: 0,
    max: 10
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
benefitSchema.index({ category: 1 });
benefitSchema.index({ impact: 1 });
benefitSchema.index({ isActive: 1 });
benefitSchema.index({ tags: 1 });
benefitSchema.index({ priority: -1 });

// Virtual for benefit summary
benefitSchema.virtual('summary').get(function() {
  return `${this.title}: ${this.description.substring(0, 100)}...`;
});

// Static method to get benefits by category
benefitSchema.statics.findByCategory = function(categoryId) {
  return this.find({ category: categoryId, isActive: true })
    .populate('category')
    .sort({ priority: -1 });
};

// Static method to get benefits by impact level
benefitSchema.statics.findByImpact = function(impactLevel) {
  return this.find({ impact: impactLevel, isActive: true })
    .populate('category')
    .sort({ priority: -1 });
};

// Static method to search benefits
benefitSchema.statics.searchBenefits = function(searchTerm) {
  return this.find({
    $or: [
      { title: { $regex: searchTerm, $options: 'i' } },
      { description: { $regex: searchTerm, $options: 'i' } },
      { tags: { $regex: searchTerm, $options: 'i' } }
    ],
    isActive: true
  }).populate('category').sort({ priority: -1 });
};

// Instance method to toggle active status
benefitSchema.methods.toggleActive = function() {
  this.isActive = !this.isActive;
  return this.save();
};

const Benefit = mongoose.model('Benefit', benefitSchema);

module.exports = Benefit;
