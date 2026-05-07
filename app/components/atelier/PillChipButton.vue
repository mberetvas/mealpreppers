<script setup lang="ts">
/**
 * Rounded chip-styled secondary action (e.g. choose image file).
 */
defineProps<{
  disabled?: boolean
}>()
</script>

<template>
  <button
    type="button"
    class="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-atelier-chip px-5 text-sm font-bold text-primary transition hover:bg-atelier-chip-hover disabled:cursor-not-allowed disabled:opacity-60"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>
