<script setup lang="ts">
import { computed } from 'vue'

/**
 * Small rounded label: catalog meta chips or category text on card imagery.
 */
const props = withDefaults(defineProps<{
  variant?: 'meta' | 'category'
}>(), {
  variant: 'meta',
})

const pillClass = computed(() => {
  if (props.variant === 'category') {
    return 'rounded-full bg-atelier-parchment/95 px-3 py-1 text-xs font-bold text-primary ring-1 ring-primary/15'
  }
  return 'rounded-full bg-atelier-chip px-3 py-1 text-xs font-bold text-atelier-neutral-action'
})
</script>

<template>
  <span :class="pillClass">
    <slot />
  </span>
</template>
