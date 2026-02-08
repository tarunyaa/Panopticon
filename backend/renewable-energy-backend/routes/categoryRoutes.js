/**
 * Category Routes
 * Defines all API endpoints for benefit categories
 */

const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const {
  validateCategoryCreation,
  validateObjectId
} = require('../middleware/validator');

/**
 * @route   GET /api/v1/categories
 * @desc    Get all categories
 * @access  Public
 */
router.get('/', categoryController.getAllCategories);

/**
 * @route   GET /api/v1/categories/slug/:slug
 * @desc    Get category by slug
 * @access  Public
 */
router.get('/slug/:slug', categoryController.getCategoryBySlug);

/**
 * @route   GET /api/v1/categories/:id
 * @desc    Get a single category by ID
 * @access  Public
 */
router.get('/:id', validateObjectId, categoryController.getCategoryById);

/**
 * @route   POST /api/v1/categories
 * @desc    Create a new category
 * @access  Public (in production, this should be protected)
 */
router.post('/', validateCategoryCreation, categoryController.createCategory);

/**
 * @route   PUT /api/v1/categories/:id
 * @desc    Update a category
 * @access  Public (in production, this should be protected)
 */
router.put('/:id', validateObjectId, categoryController.updateCategory);

/**
 * @route   DELETE /api/v1/categories/:id
 * @desc    Delete a category (soft delete)
 * @access  Public (in production, this should be protected)
 */
router.delete('/:id', validateObjectId, categoryController.deleteCategory);

module.exports = router;
