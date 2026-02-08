/**
 * Health Check Routes
 * Provides health status and API documentation
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

/**
 * @route   GET /health
 * @desc    Health check and API documentation
 * @access  Public
 */
router.get('/', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    apiDocumentation: {
      baseUrl: `${req.protocol}://${req.get('host')}`,
      version: 'v1',
      endpoints: {
        benefits: {
          description: 'Manage renewable energy benefits',
          routes: [
            {
              method: 'GET',
              path: '/api/v1/benefits',
              description: 'Get all benefits with optional filtering',
              queryParams: {
                page: 'Page number (default: 1)',
                limit: 'Items per page (default: 10, max: 100)',
                category: 'Filter by category ID',
                impact: 'Filter by impact level (high, medium, low)',
                search: 'Search in title, description, and tags',
                sortBy: 'Sort field (default: priority)',
                order: 'Sort order: asc or desc (default: desc)'
              }
            },
            {
              method: 'GET',
              path: '/api/v1/benefits/:id',
              description: 'Get a single benefit by ID'
            },
            {
              method: 'GET',
              path: '/api/v1/benefits/category/:categoryId',
              description: 'Get all benefits for a specific category'
            },
            {
              method: 'GET',
              path: '/api/v1/benefits/impact/:level',
              description: 'Get benefits by impact level (high, medium, low)'
            },
            {
              method: 'GET',
              path: '/api/v1/benefits/search',
              description: 'Search benefits',
              queryParams: {
                q: 'Search query (required)'
              }
            },
            {
              method: 'GET',
              path: '/api/v1/benefits/stats/summary',
              description: 'Get statistics summary of benefits'
            },
            {
              method: 'POST',
              path: '/api/v1/benefits',
              description: 'Create a new benefit',
              body: {
                title: 'string (required, max 200 chars)',
                description: 'string (required, max 500 chars)',
                category: 'ObjectId (required)',
                impact: 'string (optional: high, medium, low)',
                tags: 'array of strings (optional)',
                priority: 'number (optional: 0-10)',
                statistics: 'object (optional: { value, unit, source })'
              }
            },
            {
              method: 'PUT',
              path: '/api/v1/benefits/:id',
              description: 'Update a benefit',
              body: 'Same as POST, all fields optional'
            },
            {
              method: 'DELETE',
              path: '/api/v1/benefits/:id',
              description: 'Delete a benefit (soft delete)'
            }
          ]
        },
        categories: {
          description: 'Manage benefit categories',
          routes: [
            {
              method: 'GET',
              path: '/api/v1/categories',
              description: 'Get all categories with benefit counts'
            },
            {
              method: 'GET',
              path: '/api/v1/categories/:id',
              description: 'Get a single category by ID'
            },
            {
              method: 'GET',
              path: '/api/v1/categories/slug/:slug',
              description: 'Get a category by slug'
            },
            {
              method: 'POST',
              path: '/api/v1/categories',
              description: 'Create a new category',
              body: {
                name: 'string (required, max 100 chars)',
                description: 'string (required, max 300 chars)',
                icon: 'string (optional)',
                color: 'string (optional, hex color)',
                order: 'number (optional)'
              }
            },
            {
              method: 'PUT',
              path: '/api/v1/categories/:id',
              description: 'Update a category',
              body: 'Same as POST, all fields optional'
            },
            {
              method: 'DELETE',
              path: '/api/v1/categories/:id',
              description: 'Delete a category (soft delete, only if no active benefits)'
            }
          ]
        }
      },
      exampleRequests: {
        getAllBenefits: 'GET /api/v1/benefits?page=1&limit=10',
        searchBenefits: 'GET /api/v1/benefits/search?q=emissions',
        filterByCategory: 'GET /api/v1/benefits?category=CATEGORY_ID',
        filterByImpact: 'GET /api/v1/benefits/impact/high',
        getCategories: 'GET /api/v1/categories'
      },
      responseFormat: {
        success: {
          success: true,
          data: 'Response data (object or array)',
          pagination: 'Pagination metadata (when applicable)'
        },
        error: {
          success: false,
          error: {
            message: 'Error message',
            status: 'HTTP status code',
            details: 'Validation errors (when applicable)'
          }
        }
      },
      rateLimiting: {
        windowMs: '15 minutes',
        maxRequests: 100,
        message: 'Rate limiting is applied to prevent abuse'
      },
      authentication: {
        status: 'Not implemented',
        reason: 'This is a public information API. All endpoints are publicly accessible. In a production environment, write operations (POST, PUT, DELETE) should be protected with authentication and authorization middleware.'
      }
    }
  });
});

/**
 * @route   GET /health/ping
 * @desc    Simple ping endpoint
 * @access  Public
 */
router.get('/ping', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'pong',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
