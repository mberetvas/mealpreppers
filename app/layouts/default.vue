<template>
  <div class="min-h-screen bg-surface">
    <LayoutTopNavBar />
    <div class="flex pt-20">
      <main class="flex-1 bg-surface-container-low p-6 md:p-12 min-h-[calc(100vh-5rem)] pb-24 md:pb-12">
        <slot />
      </main>
    </div>
    <LayoutMobileBottomNav />
  </div>
</template>
