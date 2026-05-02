<script setup lang="ts">
const route = useRoute()

const navItems = [
  { label: 'Recipes', to: '/recipes' },
  { label: 'Weekly Plan', to: '/weekly-plan' },
  { label: 'Shopping List', to: '/shopping-list' },
  { label: 'Add Recipe', to: '/add-recipe' },
]

function isActive(to: string): boolean {
  return route.path === to
}
</script>

<template>
  <nav
    class="fixed top-0 w-full z-50 bg-stone-50/80 dark:bg-stone-900/80 backdrop-blur-md shadow-sm dark:shadow-none h-20 flex justify-between items-center px-8"
  >
    <NuxtLink to="/recipes" class="font-headline italic text-2xl font-bold text-emerald-900 dark:text-emerald-400">
      Culinary Atelier
    </NuxtLink>

    <div class="hidden md:flex items-center gap-8">
      <NuxtLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        :class="[
          isActive(item.to)
            ? 'text-emerald-800 dark:text-emerald-400 font-bold border-b-2 border-emerald-800 dark:border-emerald-400 pb-1'
            : 'text-stone-600 dark:text-stone-400 font-medium hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors',
        ]"
      >
        {{ item.label }}
      </NuxtLink>
    </div>
  </nav>
</template>
