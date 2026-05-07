<script setup lang="ts">
/**
 * Step index marker in preparation list rows.
 */
defineProps<{
  index: number
}>()
</script>

<template>
  <div class="flex size-10 items-center justify-center rounded-full bg-primary font-bold text-white">
    {{ index }}
  </div>
</template>
