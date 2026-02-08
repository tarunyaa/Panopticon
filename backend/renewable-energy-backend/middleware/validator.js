/**
 * Validation Middleware
 * Uses express-validator to validate request data
 */

const { body, param, query, validationResult } = require('express-validator');

// Middleware to check validation results
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        status: 400,
        details: errors.array()
      }
    });
  }
  next();
};

// Validation rules for benefit creation
const validateBenefitCreation = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),
  body('description')
    .trim()
    .notEmpty().withMessage('Description is required')
    .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
  body('category')
    .notEmpty().withMessage('Category is required')
    .isMongoId().withMessage('Invalid category ID'),
  body('impact')
    .optional()
    .isIn(['high', 'medium', 'low']).withMessage('Impact must be high, medium, or low'),
  body('tags')
    .optional()
    .isArray().withMessage('Tags must be an array'),
  body('priority')
    .optional()
    .isInt({ min: 0, max: 10 }).withMessage('Priority must be between 0 and 10'),
  validate
];

// Validation rules for benefit update
const validateBenefitUpdate = [
  body('title')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
  body('category')
    .optional()
    .isMongoId().withMessage('Invalid category ID'),
  body('impact')
    .optional()
    .isIn(['high', 'medium', 'low']).withMessage('Impact must be high, medium, or low'),
  body('tags')
    .optional()
    .isArray().withMessage('Tags must be an array'),
  body('priority')
    .optional()
    .isInt({ min: 0, max: 10 }).withMessage('Priority must be between 0 and 10'),
  validate
];

// Validation rules for category creation
const validateCategoryCreation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Category name is required')
    .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),
  body('description')
    .trim()
    .notEmpty().withMessage('Description is required')
    .isLength({ max: 300 }).withMessage('Description cannot exceed 300 characters'),
  body('icon')
    .optional()
    .trim(),
  body('color')
    .optional()
    .trim()
    .matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Color must be a valid hex code'),
  body('order')
    .optional()
    .isInt({ min: 0 }).withMessage('Order must be a non-negative integer'),
  validate
];

// Validation rules for MongoDB ObjectId parameters
const validateObjectId = [
  param('id').isMongoId().withMessage('Invalid ID format'),
  validate
];

// Validation rules for query parameters
const validateQueryParams = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('impact')
    .optional()
    .isIn(['high', 'medium', 'low']).withMessage('Impact must be high, medium, or low'),
  query('category')
    .optional()
    .isMongoId().withMessage('Invalid category ID'),
  validate
];

module.exports = {
  validate,
  validateBenefitCreation,
  validateBenefitUpdate,
  validateCategoryCreation,
  validateObjectId,
  validateQueryParams
};
