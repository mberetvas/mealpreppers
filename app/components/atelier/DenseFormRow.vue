<script setup lang="ts">
import { computed } from 'vue'

/**
 * High-contrast inner row for repeating form blocks (ingredients, steps).
 */
const props = withDefaults(defineProps<{
  /** When `step`, applies the step-row grid at `sm` and up. */
  layout?: 'stack' | 'step'
}>(), {
  layout: 'stack',
})

const rootClass = computed(() => {
  const base = 'grid min-w-0 gap-3 rounded-3xl bg-white/80 p-4 shadow-inner shadow-primary/5'
  if (props.layout === 'step')
    return `${base} sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start`
  return base
})
</script>

<template>
  <div :class="rootClass">
    <slot />
  </div>
</template>
