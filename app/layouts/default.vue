<template>
  <div class="min-h-screen bg-surface">
    <LayoutTopNavBar />
    <div class="flex pt-20 print:pt-0">
      <main class="flex-1 bg-surface-container-low p-6 md:p-12 min-h-[calc(100vh-5rem)] pb-24 md:pb-12 print:min-h-0 print:p-4 print:pb-4">
        <slot />
      </main>
    </div>
    <LayoutMobileBottomNav />
  </div>
</template>
