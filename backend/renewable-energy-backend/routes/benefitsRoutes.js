/**
 * Benefits Routes
 * Defines all API endpoints for renewable energy benefits
 */

const express = require('express');
const router = express.Router();
const benefitsController = require('../controllers/benefitsController');
const {
  validateBenefitCreation,
  validateBenefitUpdate,
  validateObjectId,
  validateQueryParams
} = require('../middleware/validator');

/**
 * @route   GET /api/v1/benefits
 * @desc    Get all benefits with optional filtering and pagination
 * @access  Public
 * @query   page, limit, category, impact, search, sortBy, order
 */
router.get('/', validateQueryParams, benefitsController.getAllBenefits);

/**
 * @route   GET /api/v1/benefits/search
 * @desc    Search benefits by keyword
 * @access  Public
 * @query   q (search query)
 */
router.get('/search', benefitsController.searchBenefits);

/**
 * @route   GET /api/v1/benefits/stats/summary
 * @desc    Get benefits statistics summary
 * @access  Public
 */
router.get('/stats/summary', benefitsController.getBenefitsSummary);

/**
 * @route   GET /api/v1/benefits/category/:categoryId
 * @desc    Get benefits by category ID
 * @access  Public
 */
router.get('/category/:categoryId', validateObjectId, benefitsController.getBenefitsByCategory);

/**
 * @route   GET /api/v1/benefits/impact/:level
 * @desc    Get benefits by impact level (high, medium, low)
 * @access  Public
 */
router.get('/impact/:level', benefitsController.getBenefitsByImpact);

/**
 * @route   GET /api/v1/benefits/:id
 * @desc    Get a single benefit by ID
 * @access  Public
 */
router.get('/:id', validateObjectId, benefitsController.getBenefitById);

/**
 * @route   POST /api/v1/benefits
 * @desc    Create a new benefit
 * @access  Public (in production, this should be protected)
 */
router.post('/', validateBenefitCreation, benefitsController.createBenefit);

/**
 * @route   PUT /api/v1/benefits/:id
 * @desc    Update a benefit
 * @access  Public (in production, this should be protected)
 */
router.put('/:id', validateObjectId, validateBenefitUpdate, benefitsController.updateBenefit);

/**
 * @route   DELETE /api/v1/benefits/:id
 * @desc    Delete a benefit (soft delete)
 * @access  Public (in production, this should be protected)
 */
router.delete('/:id', validateObjectId, benefitsController.deleteBenefit);

module.exports = router;
