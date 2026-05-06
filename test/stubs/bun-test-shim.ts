/**
 * Vite cannot resolve Bun's `bun:test` when bundling @nuxt/test-utils; Vitest uses `setupVitest`, but the
 * `setupBun` branch still appears in the same module graph. Re-export Vitest hooks so analysis succeeds.
 */
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest'

export { afterAll, afterEach, beforeAll, beforeEach, vi }

export const mock = vi.fn
