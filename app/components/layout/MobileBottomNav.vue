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
  <!--
    pointer-events: bar is decorative width-wise; only tab/FAB hit targets receive clicks.
    Otherwise the full-width layer steals taps meant for main content (e.g. recipe cards)
    in the same vertical band and clicks on flex gaps do nothing.
  -->
  <div
    class="pointer-events-none fixed bottom-0 z-50 flex w-full items-center justify-around border-t border-outline-variant/10 bg-surface-container-lowest px-6 py-4 md:hidden"
  >
    <NuxtLink
      v-for="tab in tabs.slice(0, 2)"
      :key="tab.to"
      :to="tab.to"
      class="pointer-events-auto flex min-h-11 min-w-11 flex-col items-center justify-end"
      :class="isActive(tab.to) ? 'text-primary' : 'text-stone-400'"
    >
      <span class="material-symbols-outlined">{{ tab.icon }}</span>
      <span class="mt-1 text-[10px] font-bold">{{ tab.label }}</span>
    </NuxtLink>

    <NuxtLink
      to="/add-recipe"
      class="pointer-events-auto -translate-y-4 rounded-full bg-primary p-4 text-on-primary shadow-xl"
    >
      <span class="material-symbols-outlined">add</span>
    </NuxtLink>

    <NuxtLink
      v-for="tab in tabs.slice(2)"
      :key="tab.to"
      :to="tab.to"
      class="pointer-events-auto flex min-h-11 min-w-11 flex-col items-center justify-end"
      :class="isActive(tab.to) ? 'text-primary' : 'text-stone-400'"
    >
      <span class="material-symbols-outlined">{{ tab.icon }}</span>
      <span class="mt-1 text-[10px] font-bold">{{ tab.label }}</span>
    </NuxtLink>
  </div>
</template>
