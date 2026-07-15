import { filterRecipes } from '../utils/recipeFiltering.ts';

function generateMockRecipes(count) {
  const recipes = [];
  for (let i = 0; i < count; i++) {
    recipes.push({
      id: `recipe-${i}`,
      title: `Recipe Title ${i}`,
      description: `Description for recipe ${i} which might be long and contain various words.`,
      difficulty: i % 3 === 0 ? 'Easy' : i % 3 === 1 ? 'Medium' : 'Hard',
      categories: [`Category ${i % 5}`, `Category ${i % 10}`],
      tags: [`Tag ${i % 20}`, `Tag ${i % 50}`],
      ingredients: Array.from({ length: 10 }, (_, j) => ({
        id: `ing-${i}-${j}`,
        position: j + 1,
        rawText: `Ingredient ${j} for recipe ${i} with some extra text to make it longer and more realistic for searching.`,
        name: `Ingredient ${j}`,
      })),
      steps: Array.from({ length: 5 }, (_, j) => ({
        id: `step-${i}-${j}`,
        position: j + 1,
        text: `Step ${j} instruction for recipe ${i}.`,
      })),
      updatedAt: new Date(Date.now() - i * 1000 * 60).toISOString(),
      createdAt: new Date(Date.now() - i * 1000 * 60 * 2).toISOString(),
    });
  }
  return recipes;
}

const recipeCount = 1000;
const iterations = 100;
const recipes = generateMockRecipes(recipeCount);

console.log(`Benchmarking filterRecipes with ${recipeCount} recipes and ${iterations} iterations...`);

const start = performance.now();

for (let i = 0; i < iterations; i++) {
  // Simulate different queries to prevent some engine optimizations if any,
  // although we want to measure the string concatenation cost mainly.
  filterRecipes(recipes, {
    query: `Recipe Title ${i % 100}`,
    category: '',
    tag: '',
    sortBy: 'updatedAt'
  });
}

const end = performance.now();
const totalTime = end - start;
const averageTime = totalTime / iterations;

console.log(`Total time: ${totalTime.toFixed(2)}ms`);
console.log(`Average time per call: ${averageTime.toFixed(2)}ms`);
