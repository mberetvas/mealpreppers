<script setup lang="ts">
import { primaryNavBrandTo, topNavItems } from '~/constants/primaryNavigation'

const route = useRoute()

const navItems = topNavItems

function isActive(to: string): boolean {
  return route.path === to
}
</script>

<template>
  <nav
    class="fixed top-0 w-full z-50 bg-atelier-parchment/80 backdrop-blur-sm sm:backdrop-blur-md shadow-sm h-20 flex justify-between items-center px-8 print:hidden"
  >
    <NuxtLink
      :to="primaryNavBrandTo"
      class="font-headline italic text-2xl font-bold text-atelier-heading"
      :aria-current="isActive(primaryNavBrandTo) ? 'page' : undefined"
    >
      Culinary Atelier
    </NuxtLink>

    <div class="hidden md:flex items-center gap-8">
      <NuxtLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        :class="[
          isActive(item.to)
            ? 'text-primary font-bold border-b-2 border-primary pb-1'
            : 'text-on-surface-variant font-medium hover:text-primary transition-colors',
        ]"
        :aria-current="isActive(item.to) ? 'page' : undefined"
      >
        {{ item.label }}
      </NuxtLink>
    </div>

    <div class="w-10" />
  </nav>
</template>
