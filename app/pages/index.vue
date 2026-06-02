<script setup lang="ts">
// Client-only: avoid prerender following into /recipes (useFetch + SQLite during generate).
onMounted(() => {
  void navigateTo('/recipes', { replace: true })
})
</script>

<template>
  <div />
</template>
