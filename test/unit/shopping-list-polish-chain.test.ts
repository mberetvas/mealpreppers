/**
 * Unit tests for the LangChain/OpenRouter AI polish chain factory (issue #022).
 * Tests config validation, chain construction, and production port integration.
 */
import { describe, expect, it, vi } from 'vitest'
import type { StructuredLogger } from '../../server/utils/structuredLogger'

// --- Tests ---

describe('createShoppingListPolishPromptTemplate', () => {
  it('does not throw when building the prompt template', async () => {
    const { createShoppingListPolishPromptTemplate } = await import('../../server/services/shopping-list/polishChainFactory')

    await expect(createShoppingListPolishPromptTemplate()).resolves.toBeDefined()
  })

  it('formatMessages substitutes consolidationContextJson and keeps literal JSON braces in system text', async () => {
    const { createShoppingListPolishPromptTemplate } = await import('../../server/services/shopping-list/polishChainFactory')

    const prompt = await createShoppingListPolishPromptTemplate()
    const messages = await prompt.formatMessages({ consolidationContextJson: '{"sections":[]}' })

    expect(messages.length).toBeGreaterThanOrEqual(2)
    const system = messages.find(m => m.getType() === 'system')
    expect(system).toBeDefined()
    const systemText = typeof system!.content === 'string' ? system!.content : String(system!.content)
    expect(systemText).toContain('{\n  "sections":')
    expect(systemText).toContain('"ingredients":')

    const user = messages.find(m => m.getType() === 'human')
    expect(user).toBeDefined()
    const userText = typeof user!.content === 'string' ? user!.content : String(user!.content)
    expect(userText).toContain('{"sections":[]}')
    expect(userText).not.toContain('{consolidationContextJson}')
  })
})

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

  it('defaults timeout to 60000 when config value is invalid or empty', async () => {
    const { createShoppingListPolishChain, DEFAULT_SHOPPING_LIST_POLISH_TIMEOUT_MS } = await import('../../server/services/shopping-list/polishChainFactory')

    const empty = createShoppingListPolishChain({
      openrouterApiKey: 'sk-or-v1-test-key',
      openrouterShoppingListModel: 'deepseek/deepseek-v4-flash',
      openrouterShoppingListTimeoutMs: '',
      openrouterAppUrl: '',
      openrouterAppTitle: 'Mealprepper',
      langsmithApiKey: '',
    })

    const invalid = createShoppingListPolishChain({
      openrouterApiKey: 'sk-or-v1-test-key',
      openrouterShoppingListModel: 'deepseek/deepseek-v4-flash',
      openrouterShoppingListTimeoutMs: 'not-a-number',
      openrouterAppUrl: '',
      openrouterAppTitle: 'Mealprepper',
      langsmithApiKey: '',
    })

    expect(empty!.timeoutMs).toBe(DEFAULT_SHOPPING_LIST_POLISH_TIMEOUT_MS)
    expect(invalid!.timeoutMs).toBe(DEFAULT_SHOPPING_LIST_POLISH_TIMEOUT_MS)
    expect(DEFAULT_SHOPPING_LIST_POLISH_TIMEOUT_MS).toBe(60_000)
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

describe('shopping list polish prompt (AI-first)', () => {
  it('system prompt describes recipe-grouped input, merge, and aisle sort', async () => {
    const { createShoppingListPolishPromptTemplate } = await import('../../server/services/shopping-list/polishChainFactory')

    const prompt = await createShoppingListPolishPromptTemplate()
    const messages = await prompt.formatMessages({ consolidationContextJson: '{}' })
    const system = messages.find(m => m.getType() === 'system')!
    const systemText = typeof system.content === 'string' ? system.content : String(system.content)

    expect(systemText).toMatch(/recipe-grouped/i)
    expect(systemText).toMatch(/g↔kg|g.*kg/i)
    expect(systemText).toContain('produce')
    expect(systemText).toMatch(/human-style name/i)
  })

  it('user template asks for full consolidated sorted list', async () => {
    const { createShoppingListPolishPromptTemplate } = await import('../../server/services/shopping-list/polishChainFactory')

    const prompt = await createShoppingListPolishPromptTemplate()
    const messages = await prompt.formatMessages({ consolidationContextJson: '{}' })
    const user = messages.find(m => m.getType() === 'human')!
    const userText = typeof user.content === 'string' ? user.content : String(user.content)

    expect(userText).toMatch(/recipe-grouped/i)
    expect(userText).toMatch(/sort by store aisle/i)
  })
})

describe('validatePolishResponse model output quirks (v2 harness)', () => {
  it('rejects renames but accepts unit aliases when names match', async () => {
    const { validatePolishResponse } = await import('../../server/services/shopping-list/polishHarness')
    const baseline = {
      lines: [
        { id: 'L1', name: 'olijfolie', quantity: 2, unit: 'el', provenance: [] },
        { id: 'L2', name: 'tomaten', quantity: 500, unit: 'g', provenance: [] },
      ],
    }

    const result = validatePolishResponse({
      lines: [
        { id: 'L1', name: 'olijfolie', quantity: 2, unit: 'eetlepel' },
        { id: 'L2', name: 'tomaten', quantity: 500, unit: 'gram' },
      ],
    }, baseline)

    expect(result.valid).toBe(true)
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
      timeoutMs: 60_000,
    }, logger)

    await port.polish({
      sections: [{
        recipeId: 'recipe-1',
        recipeTitle: 'Pasta',
        ingredients: [{ id: 'recipe-1:0', name: 'pasta', quantity: 800, unit: 'g' }],
      }],
    })

    expect(logger.info).toHaveBeenCalledWith('shopping_list.polish_start', expect.objectContaining({
      model: 'deepseek/deepseek-v4-flash',
      timeoutMs: 60_000,
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
      timeoutMs: 60_000,
    }, logger)

    await port.polish({
      sections: [{
        recipeId: 'recipe-1',
        recipeTitle: 'Pasta',
        ingredients: [{ id: 'recipe-1:0', name: 'pasta', quantity: 800, unit: 'g' }],
      }],
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
      timeoutMs: 30_000,
    }, logger)

    await expect(port.polish({
      sections: [{
        recipeId: 'recipe-1',
        recipeTitle: 'Pasta',
        ingredients: [{ id: 'recipe-1:0', name: 'pasta', quantity: 800, unit: 'g' }],
      }],
    })).rejects.toThrow('API timeout')

    expect(logger.error).toHaveBeenCalledWith('shopping_list.polish_fail', expect.objectContaining({
      latencyMs: expect.any(Number),
      model: 'deepseek/deepseek-v4-flash',
      timeoutMs: 30_000,
      abortedDueToTimeout: true,
      fallback: 'baseline_fallback',
    }))
  })

  it('marks abortedDueToTimeout false for non-timeout errors', async () => {
    const { LangChainShoppingListPolishPort, isPolishAbortTimeout } = await import('../../server/services/shopping-list/polishChainFactory')

    expect(isPolishAbortTimeout(new Error('The operation was aborted due to timeout'))).toBe(true)
    expect(isPolishAbortTimeout(new Error('rate limit'))).toBe(false)

    const mockInvoke = vi.fn().mockRejectedValue(new Error('rate limit'))
    const logger = makeLogger()
    const port = new LangChainShoppingListPolishPort({
      invoke: mockInvoke,
      model: 'deepseek/deepseek-v4-flash',
      timeoutMs: 60_000,
    }, logger)

    await expect(port.polish({
      sections: [{
        recipeId: 'recipe-1',
        recipeTitle: 'Pasta',
        ingredients: [{ id: 'recipe-1:0', name: 'pasta', quantity: 800, unit: 'g' }],
      }],
    })).rejects.toThrow('rate limit')

    expect(logger.error).toHaveBeenCalledWith('shopping_list.polish_fail', expect.objectContaining({
      abortedDueToTimeout: false,
    }))
  })
})
