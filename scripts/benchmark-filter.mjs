
const count = 500;
const recipes = [];
for (let i = 0; i < count; i++) {
  recipes.push({
    title: "Recipe " + i,
    description: "Description for recipe " + i + ". It might be a bit long to simulate real data.",
    difficulty: "Easy",
    categories: ["Lunch", "Quick"],
    tags: ["Vegetarian", "Healthy"],
    ingredients: Array.from({ length: 20 }, (_, j) => ({ rawText: "Ingredient " + j + " for recipe " + i })),
    updatedAt: new Date().toISOString(),
  });
}

const query = "recipe 499";
const normalizedQuery = query.toLowerCase();

console.log(`Benchmarking filter of ${count} recipes...`);

const start1 = performance.now();
for (let k = 0; k < 1000; k++) {
  const results = recipes.filter((recipe) => {
    const searchableText = [
      recipe.title,
      recipe.description,
      recipe.difficulty,
      ...recipe.categories,
      ...recipe.tags,
      ...recipe.ingredients.map(ingredient => ingredient.rawText),
    ].filter(Boolean).join(' ').toLowerCase();

    return searchableText.includes(normalizedQuery);
  });
}
const end1 = performance.now();
console.log(`Current filter (average): ${((end1 - start1) / 1000).toFixed(4)}ms`);

const start2 = performance.now();
for (let k = 0; k < 1000; k++) {
  const results = recipes.filter((recipe) => {
    if (recipe.title.toLowerCase().includes(normalizedQuery)) return true;
    if (recipe.description && recipe.description.toLowerCase().includes(normalizedQuery)) return true;
    if (recipe.difficulty && recipe.difficulty.toLowerCase().includes(normalizedQuery)) return true;
    for (const c of recipe.categories) if (c.toLowerCase().includes(normalizedQuery)) return true;
    for (const t of recipe.tags) if (t.toLowerCase().includes(normalizedQuery)) return true;
    for (const ing of recipe.ingredients) if (ing.rawText.toLowerCase().includes(normalizedQuery)) return true;
    return false;
  });
}
const end2 = performance.now();
console.log(`Optimized filter (average): ${((end2 - start2) / 1000).toFixed(4)}ms`);
