import type { RecipeDraft } from '../../../../types/recipe-draft'
import {
  extractDagelijksekostRecipeDocumentIdFromHtml,
  extractDagelijksekostRecipeDocumentIdFromImageUrl,
  fetchDagelijksekostInstructions,
} from '../dagelijksekostFirestore'
import { toRecipeSteps } from '../scraperUtils'

export interface DagelijksekostInstructionsFetcher {
  (documentId: string): Promise<string[] | null | undefined>
}

/**
 * Replaces sparse JSON-LD steps with full Firestore instructions when available.
 */
export async function enrichDagelijkseKostSteps(
  draft: RecipeDraft,
  html: string,
  warnings: string[],
  fetchInstructions: DagelijksekostInstructionsFetcher = fetchDagelijksekostInstructions,
): Promise<void> {
  if (draft.source.host !== 'dagelijksekost.vrt.be') {
    return
  }

  const documentId = extractDagelijksekostRecipeDocumentIdFromHtml(html)
    ?? extractDagelijksekostRecipeDocumentIdFromImageUrl(draft.imageUrl)

  if (!documentId) {
    return
  }

  const instructionTexts = await fetchInstructions(documentId)
  if (instructionTexts && instructionTexts.length > draft.steps.length) {
    draft.steps = toRecipeSteps(instructionTexts)
  }
  else if (draft.steps.length > 0 && draft.steps.length <= 2) {
    warnings.push('Could not load full preparation steps from Dagelijkse Kost; showing the short excerpt from this page.')
  }
}
