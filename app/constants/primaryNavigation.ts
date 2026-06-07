/**
 * Single source of truth for primary chrome routes and their on-disk page modules.
 * Keep `PRIMARY_NAV_PAGE_FILES` keys in sync with every path exposed by TopNavBar,
 * MobileBottomNav (including the FAB), the brand link, and the More hub (mirrors `topNavItems`).
 * Manage surface: `/saved-weekplans` (page title **Manage plans**); desktop top nav label **Saved Weekplans**.
 */
export const PRIMARY_NAV_PAGE_FILES = {
  '/recipes': 'recipes/index.vue',
  '/weekly-plan': 'weekly-plan.vue',
  '/saved-weekplans': 'saved-weekplans.vue',
  '/shopping-list': 'shopping-list.vue',
  '/add-recipe': 'add-recipe.vue',
  '/settings': 'settings.vue',
  '/more': 'more.vue',
} as const

export type PrimaryNavResolvedPath = keyof typeof PRIMARY_NAV_PAGE_FILES

/** Desktop primary links (order is presentation order). */
export const topNavItems = [
  { label: 'Recipes', to: '/recipes' },
  { label: 'Weekly Plan', to: '/weekly-plan' },
  { label: 'Saved Weekplans', to: '/saved-weekplans' },
  { label: 'Shopping List', to: '/shopping-list' },
  { label: 'Add Recipe', to: '/add-recipe' },
  { label: 'Settings', to: '/settings' },
] as const satisfies ReadonlyArray<{ label: string; to: PrimaryNavResolvedPath }>

/** Mobile bottom bar outer tabs (center FAB uses `primaryNavFabTo`). */
export const mobileBottomNavTabs = [
  { label: 'Recipes', icon: 'restaurant_menu', to: '/recipes' },
  { label: 'Plan', icon: 'calendar_month', to: '/weekly-plan' },
  { label: 'Shop', icon: 'shopping_basket', to: '/shopping-list' },
  { label: 'More', icon: 'menu', to: '/more' },
] as const satisfies ReadonlyArray<{ label: string; icon: string; to: PrimaryNavResolvedPath }>

/** Center FAB destination on mobile bottom bar. */
export const primaryNavFabTo = '/add-recipe' satisfies PrimaryNavResolvedPath

/** Brand logo in TopNavBar links here (same as Recipes home). */
export const primaryNavBrandTo = '/recipes' satisfies PrimaryNavResolvedPath

/** Distinct paths referenced by primary navigation chrome (for integrity tests). */
export function getDeclaredPrimaryNavPaths(): PrimaryNavResolvedPath[] {
  const fromTop = topNavItems.map(i => i.to)
  const fromMobile = mobileBottomNavTabs.map(t => t.to)
  const set = new Set<PrimaryNavResolvedPath>([
    ...fromTop,
    ...fromMobile,
    primaryNavFabTo,
    primaryNavBrandTo,
  ])
  return [...set]
}
