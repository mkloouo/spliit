import { fetchImageAsInlineData, generateJsonFromImage } from './gemini'

// The key is passed in by the caller (a group's own, or the instance-wide one);
// only the model name still comes from the environment.
jest.mock('./env', () => ({
  env: { GEMINI_MODEL_RECEIPT_EXTRACT: 'test-gemini-model' },
}))

const mockFetch = jest.fn()
global.fetch = mockFetch as unknown as typeof fetch

/** A Gemini `generateContent` answer made of the given content parts. */
const answer = (parts: unknown[]) => ({
  ok: true,
  status: 200,
  json: async () => ({ candidates: [{ content: { parts } }] }),
})

const SCHEMA = { type: 'object' as const }
const IMAGE = { mime_type: 'image/jpeg', data: 'AAAA' }

const generate = () =>
  generateJsonFromImage({
    apiKey: 'gem-test',
    prompt: 'read it',
    schema: SCHEMA,
    image: IMAGE,
  })

describe('generateJsonFromImage', () => {
  beforeEach(() => mockFetch.mockReset())

  it('sends the key in a header, not the URL, and asks for the schema', async () => {
    mockFetch.mockResolvedValue(answer([{ text: '{"amount":1}' }]))

    expect(await generate()).toEqual({ amount: 1 })

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('/test-gemini-model:generateContent')
    expect(url).not.toContain('gem-test')
    expect(init.headers['x-goog-api-key']).toBe('gem-test')
    const body = JSON.parse(init.body) as any
    expect(body.generationConfig.responseJsonSchema).toEqual(SCHEMA)
  })

  it('reads the answer from the non-thought parts', async () => {
    mockFetch.mockResolvedValue(
      answer([
        { text: 'thinking about the receipt', thought: true },
        { text: '{"amount":' },
        { text: '2}' },
      ]),
    )
    expect(await generate()).toEqual({ amount: 2 })
  })

  it('retries without the schema when the model rejects it', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 400 })
      .mockResolvedValueOnce(answer([{ text: '{"amount":3}' }]))

    expect(await generate()).toEqual({ amount: 3 })
    expect(mockFetch).toHaveBeenCalledTimes(2)
    const retry = JSON.parse(mockFetch.mock.calls[1][1].body) as any
    expect(retry.generationConfig).toEqual({
      responseMimeType: 'application/json',
    })
  })

  it('returns null when the answer is not the JSON it asked for', async () => {
    mockFetch.mockResolvedValue(
      answer([{ text: 'Sorry, I cannot read that.' }]),
    )
    expect(await generate()).toBeNull()
  })

  it('throws on any other HTTP error, so the retry is offered', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503 })
    await expect(generate()).rejects.toThrow('HTTP 503')
  })
})

describe('fetchImageAsInlineData', () => {
  beforeEach(() => mockFetch.mockReset())

  const image = (contentType: string | null, bytes: number) => ({
    ok: true,
    status: 200,
    headers: { get: () => contentType },
    arrayBuffer: async () => new ArrayBuffer(bytes),
  })

  it('base64-encodes the image and keeps its media type', async () => {
    mockFetch.mockResolvedValue(image('image/png;charset=binary', 3))
    expect(await fetchImageAsInlineData('https://uploads.test/a.png')).toEqual({
      mime_type: 'image/png',
      data: Buffer.alloc(3).toString('base64'),
    })
  })

  it('falls back to JPEG when the server does not say what it served', async () => {
    mockFetch.mockResolvedValue(image(null, 1))
    expect(
      (await fetchImageAsInlineData('https://uploads.test/a')).mime_type,
    ).toBe('image/jpeg')
  })

  it('refuses an image too large to inline', async () => {
    mockFetch.mockResolvedValue(image('image/jpeg', 11 * 1024 ** 2))
    await expect(
      fetchImageAsInlineData('https://uploads.test/big.jpg'),
    ).rejects.toThrow('too large')
  })

  it('throws when the image cannot be downloaded', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 })
    await expect(
      fetchImageAsInlineData('https://uploads.test/gone.jpg'),
    ).rejects.toThrow('HTTP 404')
  })
})
