/**
 * Unit tests for the LangChain/OpenRouter AI polish chain factory (issue #022).
 * Tests config validation, chain construction, and production port integration.
 */
import { describe, expect, it, vi } from 'vitest'
import type { StructuredLogger } from '../../server/utils/structuredLogger'

// --- Tests ---

describe('createShoppingListPolishChain config validation', () => {
  it('returns null when OPENROUTER_API_KEY is missing', async () => {
    const { createShoppingListPolishChain } = await import('../../server/services/shopping-list/polishChainFactory')

    const result = createShoppingListPolishChain({
      openrouterApiKey: '',
      openrouterShoppingListModel: 'deepseek/deepseek-v4-flash',
      openrouterShoppingListTimeoutMs: '30000',
      openrouterAppUrl: 'https://example.com',
      openrouterAppTitle: 'Mealprepper',
      langsmithApiKey: '',
    })

    expect(result).toBeNull()
  })

  it('returns a chain config when all required fields are present', async () => {
    const { createShoppingListPolishChain } = await import('../../server/services/shopping-list/polishChainFactory')

    const result = createShoppingListPolishChain({
      openrouterApiKey: 'sk-or-v1-test-key',
      openrouterShoppingListModel: 'deepseek/deepseek-v4-flash',
      openrouterShoppingListTimeoutMs: '30000',
      openrouterAppUrl: 'https://example.com',
      openrouterAppTitle: 'Mealprepper',
      langsmithApiKey: '',
    })

    expect(result).not.toBeNull()
    expect(result!.model).toBe('deepseek/deepseek-v4-flash')
    expect(result!.temperature).toBe(0)
    expect(result!.maxTokens).toBe(4096)
    expect(result!.timeoutMs).toBe(30000)
  })

  it('uses custom model and timeout from config', async () => {
    const { createShoppingListPolishChain } = await import('../../server/services/shopping-list/polishChainFactory')

    const result = createShoppingListPolishChain({
      openrouterApiKey: 'sk-or-v1-test-key',
      openrouterShoppingListModel: 'anthropic/claude-3-haiku',
      openrouterShoppingListTimeoutMs: '60000',
      openrouterAppUrl: 'https://app.example.com',
      openrouterAppTitle: 'TestApp',
      langsmithApiKey: '',
    })

    expect(result!.model).toBe('anthropic/claude-3-haiku')
    expect(result!.timeoutMs).toBe(60000)
  })

  it('sets attribution headers from config (not LangChain defaults)', async () => {
    const { createShoppingListPolishChain } = await import('../../server/services/shopping-list/polishChainFactory')

    const result = createShoppingListPolishChain({
      openrouterApiKey: 'sk-or-v1-test-key',
      openrouterShoppingListModel: 'deepseek/deepseek-v4-flash',
      openrouterShoppingListTimeoutMs: '30000',
      openrouterAppUrl: 'https://mealprepper.app',
      openrouterAppTitle: 'Mealprepper',
      langsmithApiKey: '',
    })

    expect(result!.appUrl).toBe('https://mealprepper.app')
    expect(result!.appTitle).toBe('Mealprepper')
  })

  it('does not configure OpenRouter plugins', async () => {
    const { createShoppingListPolishChain } = await import('../../server/services/shopping-list/polishChainFactory')

    const result = createShoppingListPolishChain({
      openrouterApiKey: 'sk-or-v1-test-key',
      openrouterShoppingListModel: 'deepseek/deepseek-v4-flash',
      openrouterShoppingListTimeoutMs: '30000',
      openrouterAppUrl: '',
      openrouterAppTitle: 'Mealprepper',
      langsmithApiKey: '',
    })

    expect(result!.plugins).toBeUndefined()
  })

  it('enables LangSmith tracing only when LANGSMITH_API_KEY is set', async () => {
    const { createShoppingListPolishChain } = await import('../../server/services/shopping-list/polishChainFactory')

    const withoutKey = createShoppingListPolishChain({
      openrouterApiKey: 'sk-or-v1-test-key',
      openrouterShoppingListModel: 'deepseek/deepseek-v4-flash',
      openrouterShoppingListTimeoutMs: '30000',
      openrouterAppUrl: '',
      openrouterAppTitle: 'Mealprepper',
      langsmithApiKey: '',
    })

    const withKey = createShoppingListPolishChain({
      openrouterApiKey: 'sk-or-v1-test-key',
      openrouterShoppingListModel: 'deepseek/deepseek-v4-flash',
      openrouterShoppingListTimeoutMs: '30000',
      openrouterAppUrl: '',
      openrouterAppTitle: 'Mealprepper',
      langsmithApiKey: 'lsv2_pt_test-key',
    })

    expect(withoutKey!.tracingEnabled).toBe(false)
    expect(withKey!.tracingEnabled).toBe(true)
  })
})

describe('LangChainShoppingListPolishPort', () => {
  function makeLogger(): StructuredLogger {
    return {
      log: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }
  }

  it('logs polish_start with model slug before invoking', async () => {
    const { LangChainShoppingListPolishPort } = await import('../../server/services/shopping-list/polishChainFactory')

    const mockInvoke = vi.fn().mockResolvedValue({
      lines: [{ id: 'L1', name: 'pasta', quantity: 800, unit: 'g' }],
      changes: [],
    })

    const logger = makeLogger()
    const port = new LangChainShoppingListPolishPort({
      invoke: mockInvoke,
      model: 'deepseek/deepseek-v4-flash',
    }, logger)

    await port.polish({
      lines: [{ id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] }],
    })

    expect(logger.info).toHaveBeenCalledWith('shopping_list.polish_start', expect.objectContaining({
      model: 'deepseek/deepseek-v4-flash',
    }))
  })

  it('logs polish_complete with latency on success', async () => {
    const { LangChainShoppingListPolishPort } = await import('../../server/services/shopping-list/polishChainFactory')

    const mockInvoke = vi.fn().mockResolvedValue({
      lines: [{ id: 'L1', name: 'pasta', quantity: 800, unit: 'g' }],
      changes: [],
    })

    const logger = makeLogger()
    const port = new LangChainShoppingListPolishPort({
      invoke: mockInvoke,
      model: 'deepseek/deepseek-v4-flash',
    }, logger)

    await port.polish({
      lines: [{ id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] }],
    })

    expect(logger.info).toHaveBeenCalledWith('shopping_list.polish_complete', expect.objectContaining({
      latencyMs: expect.any(Number),
      model: 'deepseek/deepseek-v4-flash',
      lineCount: 1,
    }))
  })

  it('logs polish_fail and rethrows on invoke error', async () => {
    const { LangChainShoppingListPolishPort } = await import('../../server/services/shopping-list/polishChainFactory')

    const mockInvoke = vi.fn().mockRejectedValue(new Error('API timeout'))

    const logger = makeLogger()
    const port = new LangChainShoppingListPolishPort({
      invoke: mockInvoke,
      model: 'deepseek/deepseek-v4-flash',
    }, logger)

    await expect(port.polish({
      lines: [{ id: 'L1', name: 'pasta', quantity: 800, unit: 'g', provenance: [] }],
    })).rejects.toThrow('API timeout')

    expect(logger.error).toHaveBeenCalledWith('shopping_list.polish_fail', expect.objectContaining({
      latencyMs: expect.any(Number),
      model: 'deepseek/deepseek-v4-flash',
    }))
  })
})
