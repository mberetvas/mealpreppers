import { z } from 'zod'
import type { StructuredLogger } from '../../utils/structuredLogger'
import type { ShoppingListPolishPort, PolishPortResult } from './polishPort'
import type { ConsolidationContext } from './exactMerge'
import { AISLE_CATEGORY_ORDER, type AisleCategory } from './aisleSort'

const aisleCategorySchema = z.enum(
  AISLE_CATEGORY_ORDER as unknown as [AisleCategory, ...AisleCategory[]],
)

/** Default polish request budget when OPENROUTER_SHOPPING_LIST_TIMEOUT_MS is unset or invalid. */
export const DEFAULT_SHOPPING_LIST_POLISH_TIMEOUT_MS = 60_000

// --- Zod schema for structured output ---

const PolishResponseLineSchema = z.object({
  id: z.string(),
  name: z.string(),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  aisleCategory: aisleCategorySchema,
})

const PolishResponseSchema = z.object({
  lines: z.array(PolishResponseLineSchema),
  changes: z.array(z.object({
    id: z.string(),
    reason: z.string(),
    absorbedIds: z.array(z.string()).optional(),
  })).optional(),
})

// --- Prompt templates (TypeScript-owned, no external markdown) ---

const AISLE_ORDER_JSON = JSON.stringify([...AISLE_CATEGORY_ORDER])

const SYSTEM_PROMPT = `You are a shopping list consolidator for a Dutch/Belgian supermarket.

You receive recipe-grouped ingredients (unmerged). Each ingredient has a stable id "{{recipeId}}:{{index}}".

Input shape:
{{
  "sections": [
    {{
      "recipeId": "...",
      "recipeTitle": "...",
      "ingredients": [
        {{ "id": "recipe-uuid:0", "name": "...", "quantity": 400, "unit": "g", "aisleCategory": "produce" }}
      ]
    }}
  ]
}}

Your job:
1. Merge duplicate ingredients across recipes (same ingredient, compatible units). Convert units only within: g↔kg, ml↔dl↔l. Never convert mass↔volume or mass↔count.
2. Merge human-style name variants (e.g. "ui, in ringen" + "ui" → "ui"; pick the clearest shopper-facing name).
3. For every line, set "aisleCategory" to exactly one of these enum values: ${AISLE_ORDER_JSON}
   Classify each ingredient for a Dutch/Belgian supermarket (produce, dairy, spices, etc.).
4. Sort the final "lines" array by supermarket walk order (the enum order above), then alphabetically by name within each category (Dutch locale).
   Preserve that order in the JSON output.
5. When merging rows, keep the lowest surviving source id (lexicographic) and list absorbed source ids in "changes".
6. Do NOT invent line ids not present in the input. Do NOT add ingredients not in the input.
7. Do NOT increase total quantity for an ingredient beyond the sum in the input (after unit conversion).
8. Optionally provide "changes" with "id", "reason", and "absorbedIds" when lines are merged.

Return ONLY structured output with "lines" and optional "changes".`

const USER_TEMPLATE = `Consolidate this recipe-grouped shopping list. Merge, convert units where allowed, assign aisleCategory per line, sort by store walk order, and return the full consolidated list.

{consolidationContextJson}`

/**
 * Builds the LangChain prompt for shopping-list polish. Literal `{`/`}` in the system
 * message are doubled (`{{`/`}}`) so `ChatPromptTemplate` does not parse JSON as variables.
 */
export async function createShoppingListPolishPromptTemplate() {
  const { ChatPromptTemplate } = await import('@langchain/core/prompts')

  return ChatPromptTemplate.fromMessages([
    ['system', SYSTEM_PROMPT],
    ['user', USER_TEMPLATE],
  ])
}

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
  invoke: (context: ConsolidationContext) => Promise<z.infer<typeof PolishResponseSchema>>
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
  const parsedTimeout = parseInt(config.openrouterShoppingListTimeoutMs, 10)
  const timeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout > 0
    ? parsedTimeout
    : DEFAULT_SHOPPING_LIST_POLISH_TIMEOUT_MS
  const maxTokens = 4096
  const temperature = 0
  const tracingEnabled = Boolean(config.langsmithApiKey)

  // Configure LangChain tracing once at chain creation, not on every invocation,
  // to avoid per-request global mutation races in concurrent environments.
  if (tracingEnabled) {
    process.env.LANGCHAIN_TRACING_V2 = 'true'
    process.env.LANGSMITH_TRACING = 'true'
    process.env.LANGSMITH_API_KEY = config.langsmithApiKey
    process.env.LANGCHAIN_PROJECT = 'mealprepper-shopping-list'
  }
  else {
    process.env.LANGCHAIN_TRACING_V2 = 'false'
    process.env.LANGSMITH_TRACING = 'false'
  }

  const invoke = async (context: ConsolidationContext): Promise<z.infer<typeof PolishResponseSchema>> => {
    const { ChatOpenRouter } = await import('@langchain/openrouter')

    const llm = new ChatOpenRouter({
      model,
      temperature,
      maxTokens,
      apiKey: config.openrouterApiKey,
      siteUrl: config.openrouterAppUrl || undefined,
      siteName: config.openrouterAppTitle || undefined,
    })

    const structuredLlm = llm.withStructuredOutput(PolishResponseSchema, {
      method: 'functionCalling',
    })

    const prompt = await createShoppingListPolishPromptTemplate()

    const chain = prompt.pipe(structuredLlm)
    const consolidationContextJson = JSON.stringify(context)

    const result = await chain.invoke(
      { consolidationContextJson },
      { signal: AbortSignal.timeout(timeoutMs) },
    )
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
  invoke: (context: ConsolidationContext) => Promise<z.infer<typeof PolishResponseSchema>>
  model: string
  timeoutMs: number
}

/** True when LangChain invoke was aborted by AbortSignal.timeout (or equivalent). */
export function isPolishAbortTimeout(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }
  if (error.name === 'TimeoutError' || error.name === 'AbortError') {
    return true
  }
  const message = error.message.toLowerCase()
  return message.includes('timeout') || message.includes('aborted')
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
  async polish(context: ConsolidationContext): Promise<PolishPortResult> {
    const startTime = Date.now()

    this.logger.info('shopping_list.polish_start', {
      model: this.chain.model,
      lineCount: context.sections.reduce((n, s) => n + s.ingredients.length, 0),
      timeoutMs: this.chain.timeoutMs,
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
            aisleCategory: l.aisleCategory,
          })),
          changes: response.changes,
        },
      }
    }
    catch (error) {
      const latencyMs = Date.now() - startTime

      const abortedDueToTimeout = isPolishAbortTimeout(error)
      this.logger.error('shopping_list.polish_fail', {
        latencyMs,
        model: this.chain.model,
        timeoutMs: this.chain.timeoutMs,
        lineCount: context.sections.reduce((n, s) => n + s.ingredients.length, 0),
        abortedDueToTimeout,
        fallback: 'baseline_fallback',
        error: error instanceof Error ? error.message : String(error),
      })

      throw error
    }
  }
}
