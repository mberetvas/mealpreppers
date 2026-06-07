import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createEvent } from 'h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { saveRecipeImageFile } from '../../server/services/recipe-catalog/recipeLocalImages'

describe('recipeLocalImages', () => {
  let dataDir: string

  beforeEach(() => {
    dataDir = mkdtempSync(path.join(tmpdir(), 'mealprepper-images-test-'))
    process.env.MEALPREPPER_DATA_DIR = dataDir
  })

  afterEach(() => {
    delete process.env.MEALPREPPER_DATA_DIR
    rmSync(dataDir, { recursive: true, force: true })
  })

  it('writes image bytes and returns a loopback URL', async () => {
    const pngBytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    )

    const socket = new Socket()
    const req = new IncomingMessage(socket)
    req.headers = { host: '127.0.0.1:3456' }
    const event = createEvent(req, new ServerResponse(req))

    const url = await saveRecipeImageFile(event, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.png', pngBytes)
    expect(url).toBe('http://127.0.0.1:3456/recipe-images/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.png')

    const filePath = path.join(dataDir, 'recipe-images', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.png')
    expect(existsSync(filePath)).toBe(true)
  })
})
