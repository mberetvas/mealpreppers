/**
 * Predefined recipe categories and tags that seed the selection dropdowns.
 * These are merged with any user-created values already present in the database.
 */

export const DEFAULT_RECIPE_CATEGORIES: readonly string[] = [
  // Meal type
  'Breakfast',
  'Brunch',
  'Lunch',
  'Dinner',
  'Snack',
  'Dessert',
  'Appetizer',
  'Side Dish',
  'Drink',
  // Dish style
  'Salad',
  'Soup',
  'Pasta',
  'Pizza',
  'Sandwich',
  'Bowl',
  'Stir-fry',
  'Baked',
  'Grilled',
  'Smoothie',
  // Cuisine
  'American',
  'Asian',
  'Belgian',
  'Chinese',
  'French',
  'Greek',
  'Indian',
  'Italian',
  'Japanese',
  'Korean',
  'Mexican',
  'Middle Eastern',
  'Mediterranean',
  'Spanish',
  'Thai',
  'Vietnamese',
]

export const DEFAULT_RECIPE_TAGS: readonly string[] = [
  // Dietary
  'Dairy-Free',
  'Gluten-Free',
  'Halal',
  'Keto',
  'Low-Calorie',
  'Low-Carb',
  'Low-Fat',
  'Paleo',
  'Plant-Based',
  'Vegan',
  'Vegetarian',
  'Whole30',
  // Effort & time
  'Easy',
  'Quick',
  '5 Ingredients',
  'One-Pot',
  'No-Cook',
  // Meal planning
  'Batch Cooking',
  'Budget-Friendly',
  'Freezer-Friendly',
  'Make-Ahead',
  'Meal Prep',
  // Occasion & audience
  'Comfort Food',
  'Date Night',
  'Kid-Friendly',
  'Party',
  // Flavour
  'High-Protein',
  'Healthy',
  'Light',
  'Spicy',
  'Sweet',
  'Hearty',
]
