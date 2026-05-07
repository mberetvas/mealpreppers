import { describe, expect, it, beforeEach } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import {
  ACCESSIBLE_OVERLAY_CONTRACT_LABEL,
  collectFocusableElements,
  handleFocusTrapKeydown,
  pushAppRootInert,
} from '../../utils/accessibleOverlayContract'
import { useAccessibleOverlayInteraction } from '../../app/composables/useAccessibleOverlayInteraction'

describe(ACCESSIBLE_OVERLAY_CONTRACT_LABEL, () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('collectFocusableElements returns tabbable controls in DOM order', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <button type="button" id="a">a</button>
      <input id="b" type="text" />
      <button type="button" id="c" disabled>c</button>
      <a href="#" id="d">d</a>
    `
    const items = collectFocusableElements(root)
    expect(items.map(el => el.id)).toEqual(['a', 'b', 'd'])
  })

  it('Tab wraps from last to first focusable inside the scope', () => {
    const scope = document.createElement('div')
    scope.innerHTML = `
      <button type="button" id="first">first</button>
      <button type="button" id="last">last</button>
    `
    document.body.append(scope)
    const first = scope.querySelector<HTMLButtonElement>('#first')!
    const last = scope.querySelector<HTMLButtonElement>('#last')!
    last.focus()
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
    const handled = handleFocusTrapKeydown(ev, scope)
    expect(handled).toBe(true)
    expect(document.activeElement).toBe(first)
    scope.remove()
  })

  it('Shift+Tab wraps from first to last focusable inside the scope', () => {
    const scope = document.createElement('div')
    scope.innerHTML = `
      <button type="button" id="first">first</button>
      <button type="button" id="last">last</button>
    `
    document.body.append(scope)
    const first = scope.querySelector<HTMLButtonElement>('#first')!
    const last = scope.querySelector<HTMLButtonElement>('#last')!
    first.focus()
    const ev = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })
    const handled = handleFocusTrapKeydown(ev, scope)
    expect(handled).toBe(true)
    expect(document.activeElement).toBe(last)
    scope.remove()
  })

  it('pushAppRootInert stacks and restores the inert attribute', () => {
    const shell = document.createElement('div')
    shell.id = '__nuxt'
    document.body.append(shell)

    const a = pushAppRootInert(shell)
    expect(shell.hasAttribute('inert')).toBe(true)
    const b = pushAppRootInert(shell)
    expect(shell.hasAttribute('inert')).toBe(true)
    b()
    expect(shell.hasAttribute('inert')).toBe(true)
    a()
    expect(shell.hasAttribute('inert')).toBe(false)
    shell.remove()
  })

  it('closes on Escape, restores focus to the trigger, and pulls focus back when background is inert', async () => {
    const Harness = defineComponent({
      setup() {
        const open = ref(false)
        const trigger = ref<HTMLButtonElement | null>(null)
        const overlay = ref<HTMLElement | null>(null)
        useAccessibleOverlayInteraction({
          open,
          scopeRef: overlay,
          restoreFocusRef: trigger,
          lockBackground: true,
          onRequestClose: () => {
            open.value = false
          },
        })
        return () =>
          h('div', [
            h(
              'div',
              { id: '__nuxt' },
              [
                h('button', { id: 'behind', type: 'button' }, 'behind'),
              ],
            ),
            h(
              'button',
              {
                ref: trigger,
                type: 'button',
                id: 'trigger',
                onClick: () => {
                  open.value = true
                },
              },
              'open',
            ),
            open.value
              ? h('div', { ref: overlay, id: 'overlay', role: 'dialog' }, [
                  h('button', { type: 'button', id: 'inner-a' }, 'a'),
                  h('button', { type: 'button', id: 'inner-b' }, 'b'),
                ])
              : null,
          ])
      },
    })

    const wrapper = mount(Harness, { attachTo: document.body })
    await flushPromises()

    const trigger = wrapper.get('#trigger').element as HTMLButtonElement
    trigger.focus()
    await wrapper.get('#trigger').trigger('click')
    await flushPromises()
    await nextTick()

    expect(document.getElementById('__nuxt')?.hasAttribute('inert')).toBe(true)

    const behindBtn = document.querySelector<HTMLButtonElement>('#behind')
    behindBtn?.focus()
    await flushPromises()
    const innerA = document.querySelector<HTMLButtonElement>('#inner-a')
    expect(document.activeElement).toBe(innerA)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    await nextTick()

    expect(wrapper.find('#overlay').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger)
    expect(document.getElementById('__nuxt')?.hasAttribute('inert')).toBe(false)

    wrapper.unmount()
  })
})
