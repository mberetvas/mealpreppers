<template>
  <aside class="hidden lg:flex flex-col gap-2 p-6 h-screen w-64 bg-stone-50 dark:bg-stone-950 fixed left-0 top-20 overflow-y-auto">
    <div class="mb-6 px-4">
      <h2 class="font-headline font-bold text-emerald-900 dark:text-emerald-500 text-xl">
        Categories
      </h2>
      <p class="text-xs text-stone-500 dark:text-stone-400 tracking-wide uppercase">
        Filter your atelier
      </p>
    </div>

    <nav class="flex flex-col gap-1">
      <a
        href="#"
        class="flex items-center gap-3 bg-emerald-100/50 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-300 rounded-xl px-4 py-3 font-semibold text-sm tracking-wide transition-all hover:translate-x-1 duration-200"
        aria-current="page"
      >
        <span class="material-symbols-outlined" aria-hidden="true">restaurant_menu</span>
        <span>All Recipes</span>
      </a>
      <a
        href="#"
        class="flex items-center gap-3 text-stone-500 dark:text-stone-400 px-4 py-3 hover:bg-stone-200/50 dark:hover:bg-stone-800/50 rounded-xl transition-all hover:translate-x-1 duration-200 text-sm tracking-wide"
      >
        <span class="material-symbols-outlined" aria-hidden="true">eco</span>
        <span>Seasonal</span>
      </a>
      <a
        href="#"
        class="flex items-center gap-3 text-stone-500 dark:text-stone-400 px-4 py-3 hover:bg-stone-200/50 dark:hover:bg-stone-800/50 rounded-xl transition-all hover:translate-x-1 duration-200 text-sm tracking-wide"
      >
        <span class="material-symbols-outlined" aria-hidden="true">timer</span>
        <span>Quick &amp; Easy</span>
      </a>
      <a
        href="#"
        class="flex items-center gap-3 text-stone-500 dark:text-stone-400 px-4 py-3 hover:bg-stone-200/50 dark:hover:bg-stone-800/50 rounded-xl transition-all hover:translate-x-1 duration-200 text-sm tracking-wide"
      >
        <span class="material-symbols-outlined" aria-hidden="true">energy_savings_leaf</span>
        <span>Vegetarian</span>
      </a>
      <a
        href="#"
        class="flex items-center gap-3 text-stone-500 dark:text-stone-400 px-4 py-3 hover:bg-stone-200/50 dark:hover:bg-stone-800/50 rounded-xl transition-all hover:translate-x-1 duration-200 text-sm tracking-wide"
      >
        <span class="material-symbols-outlined" aria-hidden="true">bakery_dining</span>
        <span>Gluten-Free</span>
      </a>
    </nav>
  </aside>
</template>
