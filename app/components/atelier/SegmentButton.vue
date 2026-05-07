<script setup lang="ts">
/**
 * Single segment tab inside `AtelierSegmentRail`.
 */
defineProps<{
  active: boolean
}>()
</script>

<template>
  <button
    type="button"
    class="min-h-11 rounded-full px-5 py-3 text-sm font-semibold transition"
    :class="active ? 'bg-primary text-white shadow-atelier-segment-active' : 'text-atelier-muted hover:bg-atelier-entry-hover'"
  >
    <slot />
  </button>
</template>
