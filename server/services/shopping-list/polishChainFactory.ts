import { z } from 'zod'
import type { StructuredLogger } from '../../utils/structuredLogger'
import type { ShoppingListPolishPort, PolishPortResult } from './polishPort'
import type { PolishContext } from './exactMerge'

// --- Zod schema for structured output ---

const PolishResponseLineSchema = z.object({
  id: z.string(),
  name: z.string(),
  quantity: z.number().optional(),
  unit: z.string().optional(),
})

const PolishResponseSchema = z.object({
  lines: z.array(PolishResponseLineSchema),
  changes: z.array(z.object({
    id: z.string(),
    reason: z.string(),
  })).optional(),
})

// --- Prompt templates (TypeScript-owned, no external markdown) ---

const SYSTEM_PROMPT = `You are a Dutch shopping list optimizer for Belgian/Dutch households.

You receive a JSON object with this shape:
{
  "lines": [
    {
      "id": "L1",
      "name": "ingredient name",
      "quantity": 400,
      "unit": "g",
      "provenance": [{ "recipeId": "...", "recipeTitle": "..." }]
    }
  ]
}

Your task:
1. Rename ingredients to Dutch supermarket-style labels (e.g., "tomaten" → "cherry tomaten" if appropriate based on provenance context).
2. Keep all line IDs from the input — do NOT invent new IDs or remove existing ones.
3. Do NOT increase any quantity beyond what is provided.
4. Do NOT change units — keep the exact same unit for each line.
5. Do NOT add ingredients that are not in the input.
6. Optionally provide a "changes" array explaining what you renamed and why.

Return ONLY the structured output with "lines" and optional "changes".`

const USER_TEMPLATE = `Polish this shopping list:

{polishContextJson}`

// --- Chain factory config ---

export interface PolishChainConfig {
  openrouterApiKey: string
  openrouterShoppingListModel: string
  openrouterShoppingListTimeoutMs: string
  openrouterAppUrl: string
  openrouterAppTitle: string
  langsmithApiKey: string
}

export interface PolishChainResult {
  model: string
  temperature: number
  maxTokens: number
  timeoutMs: number
  appUrl: string
  appTitle: string
  plugins: undefined
  tracingEnabled: boolean
  invoke: (context: PolishContext) => Promise<z.infer<typeof PolishResponseSchema>>
}

/**
 * Creates a shopping list polish chain configuration.
 * Returns null when API key is missing (skips AI polish).
 */
export function createShoppingListPolishChain(config: PolishChainConfig): PolishChainResult | null {
  if (!config.openrouterApiKey) {
    return null
  }

  const model = config.openrouterShoppingListModel
  const timeoutMs = parseInt(config.openrouterShoppingListTimeoutMs, 10) || 30000
  const maxTokens = 4096
  const temperature = 0
  const tracingEnabled = Boolean(config.langsmithApiKey)

  // Configure LangChain tracing once at chain creation, not on every invocation,
  // to avoid per-request global mutation races in concurrent environments.
  if (tracingEnabled) {
    process.env.LANGCHAIN_TRACING_V2 = 'true'
    process.env.LANGSMITH_API_KEY = config.langsmithApiKey
    process.env.LANGCHAIN_PROJECT = 'mealprepper-shopping-list'
  }
  else {
    process.env.LANGCHAIN_TRACING_V2 = 'false'
  }

  const invoke = async (context: PolishContext): Promise<z.infer<typeof PolishResponseSchema>> => {
    const { ChatOpenRouter } = await import('@langchain/openrouter')
    const { ChatPromptTemplate } = await import('@langchain/core/prompts')

    const llm = new ChatOpenRouter({
      model,
      temperature,
      maxTokens,
      timeout: timeoutMs,
      apiKey: config.openrouterApiKey,
      headers: {
        'HTTP-Referer': config.openrouterAppUrl || undefined,
        'X-Title': config.openrouterAppTitle || undefined,
      },
    })

    const structuredLlm = llm.withStructuredOutput(PolishResponseSchema, {
      method: 'functionCalling',
    })

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', SYSTEM_PROMPT],
      ['user', USER_TEMPLATE],
    ])

    const chain = prompt.pipe(structuredLlm)
    const polishContextJson = JSON.stringify(context)

    const result = await chain.invoke({ polishContextJson })
    return result
  }

  return {
    model,
    temperature,
    maxTokens,
    timeoutMs,
    appUrl: config.openrouterAppUrl,
    appTitle: config.openrouterAppTitle,
    plugins: undefined,
    tracingEnabled,
    invoke,
  }
}

// --- Invokable chain interface for the production port ---

export interface InvokableChain {
  invoke: (context: PolishContext) => Promise<z.infer<typeof PolishResponseSchema>>
  model: string
}

/**
 * Production implementation of ShoppingListPolishPort using LangChain/OpenRouter.
 * Emits structured log events for polish start, complete, and fail.
 */
export class LangChainShoppingListPolishPort implements ShoppingListPolishPort {
  private chain: InvokableChain
  private logger: StructuredLogger

  constructor(chain: InvokableChain, logger: StructuredLogger) {
    this.chain = chain
    this.logger = logger
  }

  /** Invokes the LangChain polish chain and returns the structured response. */
  async polish(context: PolishContext): Promise<PolishPortResult> {
    const startTime = Date.now()

    this.logger.info('shopping_list.polish_start', {
      model: this.chain.model,
      lineCount: context.lines.length,
    })

    try {
      const response = await this.chain.invoke(context)
      const latencyMs = Date.now() - startTime

      this.logger.info('shopping_list.polish_complete', {
        latencyMs,
        model: this.chain.model,
        lineCount: response.lines.length,
      })

      return {
        response: {
          lines: response.lines.map(l => ({
            id: l.id,
            name: l.name,
            quantity: l.quantity,
            unit: l.unit,
          })),
          changes: response.changes,
        },
      }
    }
    catch (error) {
      const latencyMs = Date.now() - startTime

      this.logger.error('shopping_list.polish_fail', {
        latencyMs,
        model: this.chain.model,
        error: error instanceof Error ? error.message : String(error),
      })

      throw error
    }
  }
}
