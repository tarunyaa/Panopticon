/**
 * Database Seeding Script
 * Pre-populates the database with renewable energy benefits data
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../models/Category');
const Benefit = require('../models/Benefit');
const config = require('../config/config');

// Category data
const categories = [
  {
    name: 'Environmental Impact',
    description: 'Benefits related to environmental protection and ecosystem health',
    icon: 'leaf',
    color: '#4CAF50',
    order: 1
  },
  {
    name: 'Economic Benefits',
    description: 'Financial and economic advantages of renewable energy',
    icon: 'dollar-sign',
    color: '#2196F3',
    order: 2
  },
  {
    name: 'Energy Security',
    description: 'Benefits related to energy independence and reliability',
    icon: 'shield',
    color: '#FF9800',
    order: 3
  },
  {
    name: 'Sustainability',
    description: 'Long-term sustainability and resource management benefits',
    icon: 'refresh',
    color: '#9C27B0',
    order: 4
  },
  {
    name: 'Health Benefits',
    description: 'Public health improvements from renewable energy adoption',
    icon: 'heart',
    color: '#F44336',
    order: 5
  }
];

// Benefits data (will be populated with category IDs after categories are created)
const getBenefitsData = (categoryMap) => [
  // Environmental Impact Benefits
  {
    title: 'Reduced Greenhouse Gas Emissions',
    description: 'Renewable energy sources produce little to no greenhouse gases, significantly reducing carbon footprint and combating climate change.',
    category: categoryMap['Environmental Impact'],
    impact: 'high',
    tags: ['climate change', 'emissions', 'carbon footprint'],
    priority: 10,
    statistics: {
      value: '90%',
      unit: 'reduction potential',
      source: 'IPCC 2022'
    }
  },
  {
    title: 'Cleaner Air Quality',
    description: 'Unlike fossil fuels, renewable energy produces no air pollutants, leading to cleaner air and reduced smog in urban areas.',
    category: categoryMap['Environmental Impact'],
    impact: 'high',
    tags: ['air quality', 'pollution', 'health'],
    priority: 9,
    statistics: {
      value: '80%',
      unit: 'reduction in air pollutants',
      source: 'EPA 2023'
    }
  },
  {
    title: 'Water Conservation',
    description: 'Most renewable energy technologies require minimal water compared to traditional power plants, preserving this vital resource.',
    category: categoryMap['Environmental Impact'],
    impact: 'medium',
    tags: ['water', 'conservation', 'resources'],
    priority: 7
  },
  {
    title: 'Reduced Land Degradation',
    description: 'Renewable energy installations have less environmental impact on land compared to mining and drilling operations.',
    category: categoryMap['Environmental Impact'],
    impact: 'medium',
    tags: ['land use', 'conservation', 'ecosystems'],
    priority: 6
  },
  {
    title: 'Wildlife Protection',
    description: 'Properly planned renewable projects minimize habitat disruption and protect biodiversity better than fossil fuel extraction.',
    category: categoryMap['Environmental Impact'],
    impact: 'medium',
    tags: ['wildlife', 'biodiversity', 'conservation'],
    priority: 5
  },

  // Economic Benefits
  {
    title: 'Job Creation',
    description: 'The renewable energy sector creates more jobs per dollar invested than fossil fuels, boosting local economies.',
    category: categoryMap['Economic Benefits'],
    impact: 'high',
    tags: ['employment', 'economy', 'growth'],
    priority: 10,
    statistics: {
      value: '12 million',
      unit: 'global renewable energy jobs',
      source: 'IRENA 2023'
    }
  },
  {
    title: 'Long-term Cost Savings',
    description: 'After initial investment, renewable energy has minimal operational costs, leading to significant long-term savings.',
    category: categoryMap['Economic Benefits'],
    impact: 'high',
    tags: ['savings', 'costs', 'investment'],
    priority: 9,
    statistics: {
      value: '40-60%',
      unit: 'cost reduction over 20 years',
      source: 'BNEF 2023'
    }
  },
  {
    title: 'Stable Energy Prices',
    description: 'Renewable energy prices are predictable and insulated from volatile fossil fuel market fluctuations.',
    category: categoryMap['Economic Benefits'],
    impact: 'high',
    tags: ['prices', 'stability', 'economics'],
    priority: 8
  },
  {
    title: 'Economic Growth',
    description: 'Investment in renewable energy stimulates economic growth and creates new business opportunities across multiple sectors.',
    category: categoryMap['Economic Benefits'],
    impact: 'medium',
    tags: ['growth', 'investment', 'business'],
    priority: 7
  },
  {
    title: 'Reduced Infrastructure Costs',
    description: 'Distributed renewable systems reduce the need for expensive grid expansion and transmission infrastructure.',
    category: categoryMap['Economic Benefits'],
    impact: 'medium',
    tags: ['infrastructure', 'grid', 'costs'],
    priority: 6
  },

  // Energy Security Benefits
  {
    title: 'Energy Independence',
    description: 'Renewable energy reduces dependence on imported fossil fuels, enhancing national energy security and sovereignty.',
    category: categoryMap['Energy Security'],
    impact: 'high',
    tags: ['independence', 'security', 'sovereignty'],
    priority: 10
  },
  {
    title: 'Diverse Energy Portfolio',
    description: 'Multiple renewable sources create a resilient, diversified energy mix that is less vulnerable to disruptions.',
    category: categoryMap['Energy Security'],
    impact: 'high',
    tags: ['diversity', 'resilience', 'reliability'],
    priority: 9
  },
  {
    title: 'Grid Resilience',
    description: 'Distributed renewable systems enhance grid reliability and reduce vulnerability to large-scale power outages.',
    category: categoryMap['Energy Security'],
    impact: 'high',
    tags: ['grid', 'resilience', 'reliability'],
    priority: 8
  },
  {
    title: 'Reduced Geopolitical Risks',
    description: 'Less reliance on fossil fuel imports decreases exposure to international conflicts and supply disruptions.',
    category: categoryMap['Energy Security'],
    impact: 'medium',
    tags: ['geopolitics', 'risk', 'security'],
    priority: 7
  },
  {
    title: 'Local Energy Production',
    description: 'Communities can generate their own power, reducing transmission losses and increasing energy self-sufficiency.',
    category: categoryMap['Energy Security'],
    impact: 'medium',
    tags: ['local', 'community', 'self-sufficiency'],
    priority: 6
  },

  // Sustainability Benefits
  {
    title: 'Inexhaustible Resources',
    description: 'Sun, wind, and water are naturally replenished and will never run out, ensuring long-term energy availability.',
    category: categoryMap['Sustainability'],
    impact: 'high',
    tags: ['renewable', 'resources', 'future'],
    priority: 10
  },
  {
    title: 'Minimal Waste Generation',
    description: 'Renewable energy systems produce virtually no toxic waste compared to fossil fuels and nuclear power.',
    category: categoryMap['Sustainability'],
    impact: 'high',
    tags: ['waste', 'pollution', 'clean'],
    priority: 9
  },
  {
    title: 'Sustainable Development',
    description: 'Renewable energy supports sustainable economic development without depleting natural resources for future generations.',
    category: categoryMap['Sustainability'],
    impact: 'high',
    tags: ['development', 'future', 'generations'],
    priority: 8
  },
  {
    title: 'Circular Economy',
    description: 'Renewable energy components are increasingly recyclable, supporting a circular economy and reducing waste.',
    category: categoryMap['Sustainability'],
    impact: 'medium',
    tags: ['recycling', 'circular', 'economy'],
    priority: 7
  },
  {
    title: 'Low Environmental Footprint',
    description: 'Operating renewable energy systems have minimal environmental impact throughout their lifecycle.',
    category: categoryMap['Sustainability'],
    impact: 'medium',
    tags: ['footprint', 'lifecycle', 'environment'],
    priority: 6
  },

  // Health Benefits
  {
    title: 'Reduced Respiratory Diseases',
    description: 'Cleaner air from renewable energy significantly reduces respiratory illnesses and asthma rates in communities.',
    category: categoryMap['Health Benefits'],
    impact: 'high',
    tags: ['health', 'respiratory', 'disease prevention'],
    priority: 10,
    statistics: {
      value: '200,000',
      unit: 'premature deaths prevented annually',
      source: 'WHO 2023'
    }
  },
  {
    title: 'Lower Healthcare Costs',
    description: 'Reduced pollution leads to fewer health complications, decreasing overall healthcare expenses for communities.',
    category: categoryMap['Health Benefits'],
    impact: 'high',
    tags: ['healthcare', 'costs', 'savings'],
    priority: 9
  },
  {
    title: 'Improved Life Expectancy',
    description: 'Cleaner environment and reduced exposure to toxins contribute to increased life expectancy in renewable energy communities.',
    category: categoryMap['Health Benefits'],
    impact: 'high',
    tags: ['life expectancy', 'health', 'longevity'],
    priority: 8
  },
  {
    title: 'Reduced Cancer Risks',
    description: 'Eliminating fossil fuel combustion removes carcinogenic pollutants, reducing cancer rates in affected populations.',
    category: categoryMap['Health Benefits'],
    impact: 'medium',
    tags: ['cancer', 'prevention', 'health'],
    priority: 7
  },
  {
    title: 'Better Mental Health',
    description: 'Living in cleaner, quieter environments with renewable energy improves mental well-being and quality of life.',
    category: categoryMap['Health Benefits'],
    impact: 'medium',
    tags: ['mental health', 'wellbeing', 'quality of life'],
    priority: 6
  }
];

// Main seeding function
async function seedDatabase() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(config.database.uri, config.database.options);
    console.log('Connected to database successfully');

    // Clear existing data
    console.log('Clearing existing data...');
    await Category.deleteMany({});
    await Benefit.deleteMany({});
    console.log('Existing data cleared');

    // Insert categories
    console.log('Inserting categories...');
    const insertedCategories = await Category.insertMany(categories);
    console.log(`${insertedCategories.length} categories inserted`);

    // Create category map for benefits
    const categoryMap = {};
    insertedCategories.forEach(cat => {
      categoryMap[cat.name] = cat._id;
    });

    // Insert benefits
    console.log('Inserting benefits...');
    const benefitsData = getBenefitsData(categoryMap);
    const insertedBenefits = await Benefit.insertMany(benefitsData);
    console.log(`${insertedBenefits.length} benefits inserted`);

    // Display summary
    console.log('\n=== Database Seeding Complete ===');
    console.log(`Total Categories: ${insertedCategories.length}`);
    console.log(`Total Benefits: ${insertedBenefits.length}`);
    
    console.log('\nCategories:');
    insertedCategories.forEach(cat => {
      const benefitCount = insertedBenefits.filter(
        b => b.category.toString() === cat._id.toString()
      ).length;
      console.log(`  - ${cat.name}: ${benefitCount} benefits`);
    });

    console.log('\nDatabase is ready for use!');
    
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  }
}

// Run the seeding function
seedDatabase();
