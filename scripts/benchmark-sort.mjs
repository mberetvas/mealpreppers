
const count = 10000;
const dates = [];
for (let i = 0; i < count; i++) {
  dates.push(new Date(Date.now() - Math.random() * 1000000000).toISOString());
}

console.log(`Benchmarking sort of ${count} ISO dates...`);

const start1 = performance.now();
const sorted1 = [...dates].sort((a, b) => b.localeCompare(a));
const end1 = performance.now();
console.log(`localeCompare: ${(end1 - start1).toFixed(2)}ms`);

const start2 = performance.now();
const sorted2 = [...dates].sort((a, b) => b > a ? 1 : b < a ? -1 : 0);
const end2 = performance.now();
console.log(`String operators (>): ${(end2 - start2).toFixed(2)}ms`);

// Verify correctness
const match = JSON.stringify(sorted1) === JSON.stringify(sorted2);
console.log(`Results match: ${match}`);
