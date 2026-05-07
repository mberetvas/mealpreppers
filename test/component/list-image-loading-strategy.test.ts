import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import RecipeCatalogGridCard from '../../app/components/recipe/RecipeCatalogGridCard.vue'
import MealSlotCard from '../../app/components/plan/MealSlotCard.vue'
import RecipePickerModal from '../../app/components/plan/RecipePickerModal.vue'
import type { RecipeCatalogItem } from '../../types/recipe-catalog-item'
import {
  LIST_IMAGE_LOADING_STRATEGY_LABEL,
  LIST_RECIPE_NON_CRITICAL_IMAGE_ATTRS,
  recipeIdentityListImageAlt,
} from '../../app/constants/listImageLoadingStrategy'

function minimalRecipe(overrides: Partial<RecipeCatalogItem> = {}): RecipeCatalogItem {
  return {
    id: 'r1',
    title: 'Test stew',
    categories: [],
    tags: [],
    ingredients: [],
    steps: [],
    createdAt: '2020-01-01T00:00:00.000Z',
    updatedAt: '2020-01-01T00:00:00.000Z',
    imageUrl: 'https://example.com/food.jpg',
    ...overrides,
  }
}

describe(LIST_IMAGE_LOADING_STRATEGY_LABEL, () => {
  it('exposes list thumb attrs that map to deferred loading in the DOM', () => {
    const Harness = defineComponent({
      setup() {
        return () =>
          h('img', {
            src: 'https://example.com/x.jpg',
            alt: recipeIdentityListImageAlt('Soup'),
            ...LIST_RECIPE_NON_CRITICAL_IMAGE_ATTRS,
          })
      },
    })
    const wrapper = mount(Harness)
    const img = wrapper.get('img').element as HTMLImageElement
    expect(img.loading).toBe('lazy')
    expect(img.decoding).toBe('async')
    expect(img.getAttribute('fetchpriority')).toBe('low')
    expect(img.alt).toBe('Photo of Soup')
  })

  it('RecipeCatalogGridCard defers catalog imagery and keeps an aspect frame', () => {
    const wrapper = mount(RecipeCatalogGridCard, {
      props: { recipe: minimalRecipe() },
    })
    const frame = wrapper.get('.aspect-\\[4\\/3\\]')
    expect(frame.exists()).toBe(true)
    const img = wrapper.get('img').element as HTMLImageElement
    expect(img.loading).toBe('lazy')
    expect(img.decoding).toBe('async')
    expect(img.getAttribute('fetchpriority')).toBe('low')
    expect(img.alt).toBe('Photo of Test stew')
  })

  it('MealSlotCard defers planner row thumbnails inside a fixed-size well', () => {
    const wrapper = mount(MealSlotCard, {
      props: {
        title: 'Dinner',
        icon: 'dinner_dining',
        recipe: minimalRecipe({ title: 'Pasta' }),
      },
    })
    const well = wrapper.get('.h-20.w-24')
    expect(well.exists()).toBe(true)
    const img = wrapper.get('img').element as HTMLImageElement
    expect(img.loading).toBe('lazy')
    expect(img.getAttribute('fetchpriority')).toBe('low')
    expect(img.alt).toBe('Photo of Pasta')
  })

  it('RecipePickerModal defers scroll-list thumbs beside visible titles', () => {
    const recipes = [
      minimalRecipe({ id: 'a', title: 'Alpha', imageUrl: 'https://example.com/a.jpg' }),
      minimalRecipe({ id: 'b', title: 'Beta', imageUrl: 'https://example.com/b.jpg' }),
    ]
    const wrapper = mount(RecipePickerModal, {
      props: {
        open: true,
        recipes,
        categories: [],
        recentlyUsedIds: [],
      },
      attachTo: document.body,
    })
    const dialogImgs = document.querySelectorAll('[role="dialog"] img')
    expect(dialogImgs.length).toBeGreaterThanOrEqual(1)
    const first = dialogImgs[0] as HTMLImageElement
    expect(first.loading).toBe('lazy')
    expect(first.getAttribute('fetchpriority')).toBe('low')
    expect(first.alt).toBe('')
    expect(first.getAttribute('aria-hidden')).toBe('true')
    wrapper.unmount()
  })
})
