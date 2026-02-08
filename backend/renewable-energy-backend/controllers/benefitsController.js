/**
 * Benefits Controller
 * Handles all business logic for renewable energy benefits
 */

const Benefit = require('../models/Benefit');
const Category = require('../models/Category');

/**
 * Get all benefits with optional filtering and pagination
 * @route GET /api/v1/benefits
 */
exports.getAllBenefits = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      impact,
      search,
      sortBy = 'priority',
      order = 'desc'
    } = req.query;

    // Build query object
    const query = { isActive: true };

    if (category) {
      query.category = category;
    }

    if (impact) {
      query.impact = impact;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = order === 'desc' ? -1 : 1;

    // Execute query with pagination
    const benefits = await Benefit.find(query)
      .populate('category', 'name description slug color icon')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination metadata
    const totalCount = await Benefit.countDocuments(query);
    const totalPages = Math.ceil(totalCount / parseInt(limit));

    res.status(200).json({
      success: true,
      data: benefits,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: totalCount,
        itemsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single benefit by ID
 * @route GET /api/v1/benefits/:id
 */
exports.getBenefitById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const benefit = await Benefit.findOne({ _id: id, isActive: true })
      .populate('category', 'name description slug color icon');

    if (!benefit) {
      const error = new Error('Benefit not found');
      error.status = 404;
      return next(error);
    }

    res.status(200).json({
      success: true,
      data: benefit
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get benefits by category
 * @route GET /api/v1/benefits/category/:categoryId
 */
exports.getBenefitsByCategory = async (req, res, next) => {
  try {
    const { categoryId } = req.params;

    // Verify category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      const error = new Error('Category not found');
      error.status = 404;
      return next(error);
    }

    const benefits = await Benefit.findByCategory(categoryId);

    res.status(200).json({
      success: true,
      data: benefits,
      category: {
        id: category._id,
        name: category.name,
        description: category.description
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get benefits by impact level
 * @route GET /api/v1/benefits/impact/:level
 */
exports.getBenefitsByImpact = async (req, res, next) => {
  try {
    const { level } = req.params;

    // Validate impact level
    if (!['high', 'medium', 'low'].includes(level)) {
      const error = new Error('Invalid impact level. Must be high, medium, or low');
      error.status = 400;
      return next(error);
    }

    const benefits = await Benefit.findByImpact(level);

    res.status(200).json({
      success: true,
      data: benefits,
      impact: level,
      count: benefits.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Search benefits
 * @route GET /api/v1/benefits/search
 */
exports.searchBenefits = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      const error = new Error('Search query is required');
      error.status = 400;
      return next(error);
    }

    const benefits = await Benefit.searchBenefits(q.trim());

    res.status(200).json({
      success: true,
      data: benefits,
      searchTerm: q,
      count: benefits.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new benefit
 * @route POST /api/v1/benefits
 */
exports.createBenefit = async (req, res, next) => {
  try {
    const benefitData = req.body;

    // Verify category exists
    const category = await Category.findById(benefitData.category);
    if (!category) {
      const error = new Error('Category not found');
      error.status = 404;
      return next(error);
    }

    const benefit = await Benefit.create(benefitData);
    await benefit.populate('category', 'name description slug color icon');

    res.status(201).json({
      success: true,
      message: 'Benefit created successfully',
      data: benefit
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a benefit
 * @route PUT /api/v1/benefits/:id
 */
exports.updateBenefit = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // If category is being updated, verify it exists
    if (updateData.category) {
      const category = await Category.findById(updateData.category);
      if (!category) {
        const error = new Error('Category not found');
        error.status = 404;
        return next(error);
      }
    }

    const benefit = await Benefit.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('category', 'name description slug color icon');

    if (!benefit) {
      const error = new Error('Benefit not found');
      error.status = 404;
      return next(error);
    }

    res.status(200).json({
      success: true,
      message: 'Benefit updated successfully',
      data: benefit
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a benefit (soft delete)
 * @route DELETE /api/v1/benefits/:id
 */
exports.deleteBenefit = async (req, res, next) => {
  try {
    const { id } = req.params;

    const benefit = await Benefit.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!benefit) {
      const error = new Error('Benefit not found');
      error.status = 404;
      return next(error);
    }

    res.status(200).json({
      success: true,
      message: 'Benefit deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get benefits summary (count by category and impact)
 * @route GET /api/v1/benefits/stats/summary
 */
exports.getBenefitsSummary = async (req, res, next) => {
  try {
    // Count by impact
    const impactStats = await Benefit.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$impact', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // Count by category
    const categoryStats = await Benefit.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $lookup: {
        from: 'categories',
        localField: '_id',
        foreignField: '_id',
        as: 'categoryInfo'
      }},
      { $unwind: '$categoryInfo' },
      { $project: {
        categoryId: '$_id',
        categoryName: '$categoryInfo.name',
        count: 1
      }},
      { $sort: { count: -1 } }
    ]);

    // Total count
    const totalCount = await Benefit.countDocuments({ isActive: true });

    res.status(200).json({
      success: true,
      data: {
        total: totalCount,
        byImpact: impactStats,
        byCategory: categoryStats
      }
    });
  } catch (error) {
    next(error);
  }
};
