<template>
  <div class="min-h-screen bg-surface">
    <LayoutTopNavBar />
    <main class="pt-20 pb-24 md:pb-20 min-h-screen">
      <slot />
    </main>
    <LayoutMobileBottomNav />
  </div>
</template>
