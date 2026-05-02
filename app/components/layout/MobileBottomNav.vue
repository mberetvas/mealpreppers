<script setup lang="ts">
const route = useRoute()

const tabs = [
  { label: 'Recipes', icon: 'restaurant_menu', to: '/recipes' },
  { label: 'Plan', icon: 'calendar_month', to: '/weekly-plan' },
  { label: 'Shop', icon: 'shopping_basket', to: '/shopping-list' },
  { label: 'Profile', icon: 'account_circle', to: '#' },
]

function isActive(to: string): boolean {
  return route.path === to
}
</script>

<template>
  <div class="fixed bottom-0 w-full md:hidden bg-surface-container-lowest border-t border-outline-variant/10 px-6 py-4 flex justify-around items-center z-50">
    <NuxtLink
      v-for="tab in tabs.slice(0, 2)"
      :key="tab.to"
      :to="tab.to"
      class="flex flex-col items-center"
      :class="isActive(tab.to) ? 'text-primary' : 'text-stone-400'"
    >
      <span class="material-symbols-outlined">{{ tab.icon }}</span>
      <span class="text-[10px] font-bold mt-1">{{ tab.label }}</span>
    </NuxtLink>

    <NuxtLink to="/add-recipe" class="bg-primary text-on-primary p-4 rounded-full -translate-y-4 shadow-xl">
      <span class="material-symbols-outlined">add</span>
    </NuxtLink>

    <NuxtLink
      v-for="tab in tabs.slice(2)"
      :key="tab.to"
      :to="tab.to"
      class="flex flex-col items-center"
      :class="isActive(tab.to) ? 'text-primary' : 'text-stone-400'"
    >
      <span class="material-symbols-outlined">{{ tab.icon }}</span>
      <span class="text-[10px] font-bold mt-1">{{ tab.label }}</span>
    </NuxtLink>
  </div>
</template>
