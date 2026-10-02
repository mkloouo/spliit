import { env } from '../../../../lib/env'
import { extractExpenseInformationFromImage } from './create-from-receipt-button-actions'

// See the note in src/components/expense-form-actions.test.ts on why these are
// `var`s reached through an arrow.
var mockCreate = jest.fn()
var mockGenerate = jest.fn()
var mockFetchImage = jest.fn()

jest.mock('../../../../lib/gemini', () => ({
  fetchImageAsInlineData: (...args: unknown[]) => mockFetchImage(...args),
  generateJsonFromImage: (...args: unknown[]) => mockGenerate(...args),
}))

jest.mock('openai', () => ({
  __esModule: true,
  default: class {
    chat = {
      completions: { create: (...args: unknown[]) => mockCreate(...args) },
    }
  },
}))
jest.mock('../../../../lib/env', () => ({
  env: {
    OPENAI_API_KEY: 'sk-test',
    OPENAI_BASE_URL: undefined,
    OPENAI_MODEL_RECEIPT_EXTRACT: 'test-vision-model',
    GEMINI_API_KEY: undefined as string | undefined,
    GEMINI_MODEL_RECEIPT_EXTRACT: 'test-gemini-model',
  },
}))
jest.mock('../../../../lib/featureFlags', () => ({
  getRuntimeFeatureFlags: async () => ({ enableReceiptExtract: true }),
}))
jest.mock('../../../../lib/api', () => ({
  getCategories: async () => [
    { id: 0, grouping: 'General', name: 'General' },
    { id: 4, grouping: 'Transport', name: 'Taxi' },
  ],
}))
jest.mock('../../../../lib/uploaded-image-url', () => ({
  isAllowedUploadUrl: (url: string) => url.startsWith('https://uploads.test/'),
}))

const IMAGE = 'https://uploads.test/receipt.jpg'

function respondWith(content: string | null) {
  mockCreate.mockResolvedValue({ choices: [{ message: { content } }] })
}

const NOTHING_EXTRACTED = {
  amount: null,
  categoryId: null,
  date: null,
  title: null,
  items: [],
}

describe('extractExpenseInformationFromImage', () => {
  beforeEach(() => mockCreate.mockReset())

  it('returns every field the model read off the receipt', async () => {
    respondWith(
      JSON.stringify({
        amount: 42.5,
        categoryId: '4',
        date: '2026-03-01',
        title: 'Dinner',
        items: [
          { title: 'Pizza', amount: 30 },
          { title: 'Beer', amount: 12.5 },
        ],
      }),
    )
    expect(await extractExpenseInformationFromImage(IMAGE)).toEqual({
      amount: 42.5,
      categoryId: '4',
      date: '2026-03-01',
      title: 'Dinner',
      items: [
        { title: 'Pizza', amount: 30 },
        { title: 'Beer', amount: 12.5 },
      ],
    })
  })

  it('reads a receipt with no legible line items', async () => {
    respondWith(
      JSON.stringify({
        amount: 42.5,
        categoryId: '4',
        date: '2026-03-01',
        title: 'Dinner',
        items: [],
      }),
    )
    expect((await extractExpenseInformationFromImage(IMAGE)).items).toEqual([])
  })

  it('drops items the model could not actually read', async () => {
    respondWith(
      JSON.stringify({
        amount: 42.5,
        categoryId: '4',
        date: '2026-03-01',
        title: 'Dinner',
        items: [
          { title: '  ', amount: 1 },
          { title: ' Beer ', amount: 12.5 },
        ],
      }),
    )
    expect((await extractExpenseInformationFromImage(IMAGE)).items).toEqual([
      { title: 'Beer', amount: 12.5 },
    ])
  })

  it('keeps a title containing a comma intact', async () => {
    respondWith(
      JSON.stringify({
        amount: 42.5,
        categoryId: '4',
        date: '2026-03-01',
        title: 'Dinner, drinks and tip',
      }),
    )
    const info = await extractExpenseInformationFromImage(IMAGE)
    expect(info.title).toBe('Dinner, drinks and tip')
    expect(info.amount).toBe(42.5)
  })

  it('asks for a strict JSON schema, and for the configured model', async () => {
    respondWith(
      JSON.stringify({
        amount: 1,
        categoryId: '0',
        date: '2026-03-01',
        title: 'x',
      }),
    )
    await extractExpenseInformationFromImage(IMAGE)

    const request = mockCreate.mock.calls[0][0]
    expect(request.model).toBe('test-vision-model')
    expect(request.response_format.type).toBe('json_schema')
    expect(request.response_format.json_schema.strict).toBe(true)
  })

  it.each([
    [
      'a field of the wrong type',
      JSON.stringify({
        amount: '42.5',
        categoryId: '4',
        date: '2026-03-01',
        title: 'x',
      }),
    ],
    ['a missing field', JSON.stringify({ amount: 42.5, categoryId: '4' })],
    ['a response that is not JSON', '42.5,4,2026-03-01,Dinner'],
    ['an empty response', ''],
  ])('reports nothing extracted for %s', async (_name, content) => {
    respondWith(content)
    expect(await extractExpenseInformationFromImage(IMAGE)).toEqual(
      NOTHING_EXTRACTED,
    )
  })

  it('reports nothing extracted when there is no content at all', async () => {
    respondWith(null)
    expect(await extractExpenseInformationFromImage(IMAGE)).toEqual(
      NOTHING_EXTRACTED,
    )
  })

  it('refuses an image URL the app did not upload', async () => {
    respondWith(JSON.stringify({ amount: 1 }))
    await expect(
      extractExpenseInformationFromImage('https://evil.example/receipt.jpg'),
    ).rejects.toThrow('Invalid image URL.')
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

describe('extractExpenseInformationFromImage, with a Gemini key', () => {
  const mockEnv = env as { GEMINI_API_KEY?: string }

  beforeEach(() => {
    mockCreate.mockReset()
    mockGenerate.mockReset()
    mockFetchImage.mockReset()
    mockEnv.GEMINI_API_KEY = 'gem-test'
    mockFetchImage.mockResolvedValue({ mime_type: 'image/jpeg', data: 'AAAA' })
  })
  afterEach(() => {
    delete mockEnv.GEMINI_API_KEY
  })

  it('reads the receipt with Gemini instead of OpenAI', async () => {
    mockGenerate.mockResolvedValue({
      amount: 42.5,
      categoryId: '4',
      date: '2026-03-01',
      title: 'Dinner',
      items: [{ title: 'Beer', amount: 12.5 }],
    })

    expect(await extractExpenseInformationFromImage(IMAGE)).toEqual({
      amount: 42.5,
      categoryId: '4',
      date: '2026-03-01',
      title: 'Dinner',
      items: [{ title: 'Beer', amount: 12.5 }],
    })
    // Gemini does not fetch the image itself, so the app inlines it.
    expect(mockFetchImage).toHaveBeenCalledWith(IMAGE)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('reports nothing extracted when Gemini answers off-schema', async () => {
    mockGenerate.mockResolvedValue({ total: 42.5, store: 'Somewhere' })
    expect(await extractExpenseInformationFromImage(IMAGE)).toEqual(
      NOTHING_EXTRACTED,
    )
  })

  it('refuses an image URL the app did not upload', async () => {
    await expect(
      extractExpenseInformationFromImage('https://evil.example/receipt.jpg'),
    ).rejects.toThrow('Invalid image URL.')
    expect(mockFetchImage).not.toHaveBeenCalled()
  })
})
