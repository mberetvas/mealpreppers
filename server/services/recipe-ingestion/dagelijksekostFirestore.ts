/**
 * Dagelijkse Kost full preparation steps: JSON-LD on the recipe page only lists a
 * short `recipeInstructions` snippet. Complete steps are stored in Firestore
 * (publicly readable) under `recipes/{documentId}.instructions`.
 */

const DAGELIJKSE_KOST_FS_DOC_URL = (documentId: string) =>
  `https://firestore.googleapis.com/v1/projects/dagelijkse-kost-prod/databases/(default)/documents/recipes/${encodeURIComponent(documentId)}`

const RECIPE_ID_IN_PATH = /\/recipes\/([A-Za-z0-9]{8,32})\//
const REQUEST_HEADERS = { 'user-agent': 'Mealprepper recipe importer' } as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Resolves the Firestore recipe document id from embedded storage URLs
 * (e.g. in og:image, JSON-LD, or RSC payload).
 */
export function extractDagelijksekostRecipeDocumentIdFromHtml(html: string): string | undefined {
  const m = RECIPE_ID_IN_PATH.exec(html)
  return m?.[1]
}

/**
 * Same path pattern, for use when HTML did not include storage URLs (fallback from draft.imageUrl).
 */
export function extractDagelijksekostRecipeDocumentIdFromImageUrl(
  imageUrl: string | undefined,
): string | undefined {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return undefined
  }
  const m = RECIPE_ID_IN_PATH.exec(imageUrl)
  return m?.[1]
}

/**
 * Parses the Firestore REST `fields.instructions` value (or equivalent map/array shape).
 * Returns ordered step strings, or undefined if not parseable.
 */
export function parseFirestoreInstructionStrings(instructionsNode: unknown): string[] | undefined {
  if (!isRecord(instructionsNode)) {
    return undefined
  }

  if (isRecord(instructionsNode.mapValue) && isRecord(instructionsNode.mapValue.fields)) {
    return mapFieldsToStepStrings(instructionsNode.mapValue.fields)
  }

  if (isRecord(instructionsNode.arrayValue) && Array.isArray(instructionsNode.arrayValue.values)) {
    const fromArray = arrayValuesToStepStrings(instructionsNode.arrayValue.values)
    return fromArray.length > 0 ? fromArray : undefined
  }

  return undefined
}

function readStringValue(node: unknown): string | undefined {
  if (!isRecord(node) || typeof node.stringValue !== 'string') {
    return undefined
  }
  return node.stringValue
}

function mapFieldsToStepStrings(fields: Record<string, unknown>): string[] | undefined {
  const entries: { index: number, text: string }[] = []
  for (const [key, value] of Object.entries(fields)) {
    const i = Number.parseInt(key, 10)
    if (Number.isNaN(i) || i < 0) {
      continue
    }
    const text = readStringValue(value)?.trim()
    if (text) {
      entries.push({ index: i, text })
    }
  }
  if (entries.length === 0) {
    return undefined
  }
  entries.sort((a, b) => a.index - b.index)
  return entries.map(e => e.text)
}

function arrayValuesToStepStrings(values: unknown[]): string[] {
  const out: string[] = []
  for (const value of values) {
    const text = readStringValue(value)?.trim()
    if (text) {
      out.push(text)
    }
  }
  return out.length > 0 ? out : []
}

type FirestoreDocumentResponse = { fields?: Record<string, unknown> }

/**
 * Fetches full step texts from the public Firestore document for a Dagelijkse Kost recipe.
 */
export async function fetchDagelijksekostInstructions(
  documentId: string,
  fetcher: typeof globalThis.fetch = globalThis.fetch,
): Promise<string[] | undefined> {
  try {
    const response = await fetcher(DAGELIJKSE_KOST_FS_DOC_URL(documentId), { headers: REQUEST_HEADERS })
    if (!response.ok) {
      return undefined
    }
    const data: FirestoreDocumentResponse = await response.json()
    const instructions = data?.fields?.instructions
    const parsed = parseFirestoreInstructionStrings(instructions)
    return parsed && parsed.length > 0 ? parsed : undefined
  }
  catch {
    return undefined
  }
}
