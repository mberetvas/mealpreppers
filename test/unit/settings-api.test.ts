import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp, createError, eventHandler, toNodeListener } from 'h3'
import { Readable } from 'node:stream'
import { ServerResponse } from 'node:http'
import type { IncomingMessage } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import getSettingsHandler from '../../server/api/v1/settings/index.get'
import patchSettingsHandler from '../../server/api/v1/settings/index.patch'
import { getDb, resetDbForTests } from '../../server/db/sqlite'
import { DEFAULT_OPENROUTER_SHOPPING_LIST_MODEL } from '../../server/services/settings/installSettingsValidation'

function createTestApp() {
  const app = createApp()
  app.use('/api/v1/settings', eventHandler((event) => {
    if (event.method === 'GET') {
      return getSettingsHandler(event)
    }
    if (event.method === 'PATCH') {
      return patchSettingsHandler(event)
    }
    throw createError({ statusCode: 405, statusMessage: 'Method not allowed.' })
  }))
  return toNodeListener(app)
}

function callListener(
  listener: ReturnType<typeof toNodeListener>,
  opts: { method: string, url: string, headers?: Record<string, string>, body?: string },
): Promise<{ statusCode: number, body: string }> {
  const body = opts.body ?? ''
  return new Promise((resolve) => {
    const req = new Readable() as unknown as IncomingMessage
    req.push(body)
    req.push(null)
    Object.assign(req, {
      method: opts.method,
      url: opts.url,
      headers: {
        ...(opts.headers ?? {}),
        'content-length': String(Buffer.byteLength(body)),
      },
    })

    const res = new ServerResponse(req)
    const chunks: Buffer[] = []
    const originalWrite = res.write.bind(res)
    const originalEnd = res.end.bind(res)

    res.write = ((chunk: Buffer | string) => {
      chunks.push(Buffer.from(chunk))
      return originalWrite(chunk)
    }) as typeof res.write

    res.end = ((chunk?: Buffer | string) => {
      if (chunk) chunks.push(Buffer.from(chunk))
      resolve({
        statusCode: res.statusCode,
        body: Buffer.concat(chunks).toString(),
      })
      return originalEnd(chunk)
    }) as typeof res.end

    listener(req as IncomingMessage, res)
  })
}

describe('settings API handlers', () => {
  let dataDir: string
  let databasePath: string
  let listener: ReturnType<typeof toNodeListener>

  beforeEach(() => {
    resetDbForTests()
    dataDir = mkdtempSync(path.join(tmpdir(), 'mealprepper-settings-api-test-'))
    databasePath = path.join(dataDir, 'mealprepper.db')
    process.env.MEALPREPPER_DATA_DIR = dataDir
    process.env.DATABASE_PATH = databasePath
    getDb()
    listener = createTestApp()
  })

  afterEach(() => {
    resetDbForTests()
    delete process.env.MEALPREPPER_DATA_DIR
    delete process.env.DATABASE_PATH
    if (dataDir) {
      rmSync(dataDir, { recursive: true, force: true })
    }
  })

  it('GET returns the default model on a fresh database', async () => {
    const response = await callListener(listener, {
      method: 'GET',
      url: '/api/v1/settings',
    })

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({
      openrouterShoppingListModel: DEFAULT_OPENROUTER_SHOPPING_LIST_MODEL,
    })
  })

  it('PATCH persists a valid model', async () => {
    const response = await callListener(listener, {
      method: 'PATCH',
      url: '/api/v1/settings',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ openrouterShoppingListModel: 'anthropic/claude-3.5-sonnet' }),
    })

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({
      openrouterShoppingListModel: 'anthropic/claude-3.5-sonnet',
    })
  })

  it('PATCH rejects invalid model ids', async () => {
    const response = await callListener(listener, {
      method: 'PATCH',
      url: '/api/v1/settings',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ openrouterShoppingListModel: 'not-a-valid-slug' }),
    })

    expect(response.statusCode).toBe(400)
    const json = JSON.parse(response.body)
    expect(json.statusMessage).toMatch(/provider\/model/i)
  })
})
