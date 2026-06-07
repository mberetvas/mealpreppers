import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp, createError, eventHandler, toNodeListener } from 'h3'
import { Readable } from 'node:stream'
import { ServerResponse } from 'node:http'
import type { IncomingMessage } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import listRecipesHandler from '../../server/api/v1/recipes/index.get'
import createRecipeHandler from '../../server/api/v1/recipes/index.post'
import optionsHandler from '../../server/api/v1/recipes/options.get'
import { getDb, resetDbForTests } from '../../server/db/sqlite'

function createTestApp() {
  const app = createApp()
  app.use('/api/v1/recipes/options', optionsHandler)
  app.use('/api/v1/recipes', eventHandler((event) => {
    if (event.method === 'GET') {
      return listRecipesHandler(event)
    }
    if (event.method === 'POST') {
      return createRecipeHandler(event)
    }
    throw createError({ statusCode: 405, statusMessage: 'Method not allowed.' })
  }))
  return toNodeListener(app)
}

/** Invokes an h3 node listener with a minimal mock request. */
function callListener(
  listener: ReturnType<typeof toNodeListener>,
  opts: { method: string, url: string, headers: Record<string, string>, body: string },
): Promise<{ statusCode: number, body: string }> {
  return new Promise((resolve) => {
    const req = new Readable() as unknown as IncomingMessage
    req.push(opts.body)
    req.push(null)
    Object.assign(req, {
      method: opts.method,
      url: opts.url,
      headers: { ...opts.headers, 'content-length': String(Buffer.byteLength(opts.body)) },
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

describe('recipe API handlers (SQLite)', () => {
  let dataDir: string
  let databasePath: string
  let listener: ReturnType<typeof toNodeListener>

  beforeEach(() => {
    resetDbForTests()
    dataDir = mkdtempSync(path.join(tmpdir(), 'mealprepper-api-test-'))
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
    rmSync(dataDir, { recursive: true, force: true })
  })

  it('creates a recipe and lists it', async () => {
    const createBody = JSON.stringify({
      title: 'API Soup',
      categories: ['Lunch'],
      tags: ['Soup'],
      ingredients: [{ rawText: '1L stock', name: 'stock' }],
      steps: [],
    })

    const createdResponse = await callListener(listener, {
      method: 'POST',
      url: '/api/v1/recipes',
      headers: { 'content-type': 'application/json', host: '127.0.0.1:3456' },
      body: createBody,
    })

    expect(createdResponse.statusCode).toBe(200)
    const created = JSON.parse(createdResponse.body) as { id: string, title: string }
    expect(created.title).toBe('API Soup')

    const listResponse = await callListener(listener, {
      method: 'GET',
      url: '/api/v1/recipes',
      headers: { host: '127.0.0.1:3456' },
      body: '',
    })

    expect(listResponse.statusCode).toBe(200)
    const listed = JSON.parse(listResponse.body) as Array<{ id: string }>
    expect(listed).toHaveLength(1)
    expect(listed[0]?.id).toBe(created.id)
  })

  it('returns merged recipe options', async () => {
    await callListener(listener, {
      method: 'POST',
      url: '/api/v1/recipes',
      headers: { 'content-type': 'application/json', host: '127.0.0.1:3456' },
      body: JSON.stringify({
        title: 'Tagged Bowl',
        categories: ['CustomCategory'],
        tags: ['CustomTag'],
        ingredients: [{ rawText: 'rice', name: 'rice' }],
        steps: [],
      }),
    })

    const optionsResponse = await callListener(listener, {
      method: 'GET',
      url: '/api/v1/recipes/options',
      headers: { host: '127.0.0.1:3456' },
      body: '',
    })

    expect(optionsResponse.statusCode).toBe(200)
    const options = JSON.parse(optionsResponse.body) as { categories: string[], tags: string[] }
    expect(options.categories).toContain('CustomCategory')
    expect(options.tags).toContain('CustomTag')
  })

})

