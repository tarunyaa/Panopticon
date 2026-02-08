/**
 * Category Controller
 * Handles all business logic for benefit categories
 */

const Category = require('../models/Category');
const Benefit = require('../models/Benefit');

/**
 * Get all categories
 * @route GET /api/v1/categories
 */
exports.getAllCategories = async (req, res, next) => {
  try {
    const categories = await Category.getActiveCategories();

    // Get benefit counts for each category
    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const benefitCount = await Benefit.countDocuments({
          category: category._id,
          isActive: true
        });
        return {
          ...category.toObject(),
          benefitCount
        };
      })
    );

    res.status(200).json({
      success: true,
      data: categoriesWithCounts,
      count: categoriesWithCounts.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single category by ID
 * @route GET /api/v1/categories/:id
 */
exports.getCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const category = await Category.findOne({ _id: id, isActive: true });

    if (!category) {
      const error = new Error('Category not found');
      error.status = 404;
      return next(error);
    }

    // Get benefit count
    const benefitCount = await Benefit.countDocuments({
      category: category._id,
      isActive: true
    });

    res.status(200).json({
      success: true,
      data: {
        ...category.toObject(),
        benefitCount
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get category by slug
 * @route GET /api/v1/categories/slug/:slug
 */
exports.getCategoryBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;

    const category = await Category.findBySlug(slug);

    if (!category) {
      const error = new Error('Category not found');
      error.status = 404;
      return next(error);
    }

    // Get benefit count
    const benefitCount = await Benefit.countDocuments({
      category: category._id,
      isActive: true
    });

    res.status(200).json({
      success: true,
      data: {
        ...category.toObject(),
        benefitCount
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new category
 * @route POST /api/v1/categories
 */
exports.createCategory = async (req, res, next) => {
  try {
    const categoryData = req.body;

    const category = await Category.create(categoryData);

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a category
 * @route PUT /api/v1/categories/:id
 */
exports.updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const category = await Category.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!category) {
      const error = new Error('Category not found');
      error.status = 404;
      return next(error);
    }

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: category
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a category (soft delete)
 * @route DELETE /api/v1/categories/:id
 */
exports.deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if category has associated benefits
    const benefitCount = await Benefit.countDocuments({
      category: id,
      isActive: true
    });

    if (benefitCount > 0) {
      const error = new Error(
        `Cannot delete category with ${benefitCount} active benefits. Please reassign or delete the benefits first.`
      );
      error.status = 400;
      return next(error);
    }

    const category = await Category.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!category) {
      const error = new Error('Category not found');
      error.status = 404;
      return next(error);
    }

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
