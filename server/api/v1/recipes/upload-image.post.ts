import { randomUUID } from 'node:crypto'
import { readMultipartFormData } from 'h3'
import {
  RECIPE_IMAGE_MIME_TO_EXT,
  validateRecipeImageFile,
} from '../../../../app/utils/recipeImageValidation'
import { saveRecipeImageFile } from '../../../services/recipe-catalog/recipeLocalImages'

export default defineEventHandler(async (event) => {
  const parts = await readMultipartFormData(event)
  const filePart = parts?.find(part => part.name === 'file' && part.filename && part.data?.length)

  if (!filePart?.data?.length || !filePart.filename) {
    throw createError({ statusCode: 400, statusMessage: 'Choose an image file to upload.' })
  }

  const mimeType = filePart.type || 'application/octet-stream'
  const validated = validateRecipeImageFile(mimeType, filePart.data.length)

  if (!validated.ok) {
    throw createError({ statusCode: 400, statusMessage: validated.statusMessage })
  }

  const ext = RECIPE_IMAGE_MIME_TO_EXT[mimeType]
  if (!ext) {
    throw createError({ statusCode: 400, statusMessage: 'Use a JPEG, PNG, WebP, or GIF image.' })
  }

  const filename = `${randomUUID()}.${ext}`
  const url = await saveRecipeImageFile(event, filename, filePart.data)

  return { url }
})
