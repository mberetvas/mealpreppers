<script setup lang="ts">
import { topNavItems } from '~/constants/primaryNavigation'
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-8">
    <header class="space-y-2">
      <h1 class="font-headline text-2xl font-bold text-emerald-900 dark:text-emerald-400">
        More
      </h1>
      <p class="text-stone-600 dark:text-stone-400">
        Quick access to every main area of the app from your phone.
      </p>
    </header>

    <nav aria-label="Main sections" class="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
      <ul class="divide-y divide-outline-variant/15">
        <li v-for="item in topNavItems" :key="item.to" class="py-3 first:pt-0 last:pb-0">
          <NuxtLink
            :to="item.to"
            class="flex items-center justify-between font-medium text-stone-800 transition-colors hover:text-primary dark:text-stone-200 dark:hover:text-primary"
          >
            {{ item.label }}
            <span class="material-symbols-outlined text-stone-400 text-xl" aria-hidden="true">chevron_right</span>
          </NuxtLink>
        </li>
      </ul>
    </nav>
  </div>
</template>
