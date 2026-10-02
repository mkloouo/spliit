/**
 * `env` is parsed once, when the module loads, so each case loads a fresh copy
 * with its own `process.env`.
 */
function loadEnv(vars: Record<string, string>) {
  const original = process.env
  process.env = {
    ...original,
    POSTGRES_URL_NON_POOLING: 'postgresql://localhost/spliit',
    POSTGRES_PRISMA_URL: 'postgresql://localhost/spliit',
    ANALYTICS_PROVIDER: '',
    ...vars,
  }
  try {
    let env: typeof import('./env').env | undefined
    jest.isolateModules(() => {
      env = require('./env').env
    })
    return env!
  } finally {
    process.env = original
  }
}

describe('ANALYTICS_PROVIDER', () => {
  it('is disabled when unset or blank', () => {
    expect(loadEnv({}).ANALYTICS_PROVIDER).toEqual([])
    expect(loadEnv({ ANALYTICS_PROVIDER: '  ' }).ANALYTICS_PROVIDER).toEqual([])
  })

  it('accepts a single provider', () => {
    expect(
      loadEnv({ ANALYTICS_PROVIDER: 'console' }).ANALYTICS_PROVIDER,
    ).toEqual(['console'])
  })

  it('accepts several, comma-separated, in order and without repeats', () => {
    expect(
      loadEnv({
        ANALYTICS_PROVIDER: ' plausible, console ,plausible, ',
        PLAUSIBLE_DOMAIN: 'example.com',
      }).ANALYTICS_PROVIDER,
    ).toEqual(['plausible', 'console'])
  })

  it('rejects an unknown provider', () => {
    expect(() => loadEnv({ ANALYTICS_PROVIDER: 'console,nope' })).toThrow()
  })

  it('requires each listed provider’s own variables', () => {
    expect(() => loadEnv({ ANALYTICS_PROVIDER: 'plausible' })).toThrow(
      /PLAUSIBLE_DOMAIN/,
    )
    expect(() =>
      loadEnv({ ANALYTICS_PROVIDER: 'umami', PLAUSIBLE_DOMAIN: 'example.com' }),
    ).toThrow(/UMAMI_WEBSITE_ID/)
    expect(() =>
      loadEnv({
        ANALYTICS_PROVIDER: 'plausible,umami',
        PLAUSIBLE_DOMAIN: 'example.com',
        UMAMI_WEBSITE_ID: 'website-id',
      }),
    ).not.toThrow()
  })
})

describe('AI feature keys', () => {
  it('lets the receipt reader run on either an OpenAI or a Gemini key', () => {
    expect(() => loadEnv({ ENABLE_RECEIPT_EXTRACT: 'true' })).toThrow(
      /OPENAI_API_KEY or GEMINI_API_KEY/,
    )
    expect(() =>
      loadEnv({ ENABLE_RECEIPT_EXTRACT: 'true', OPENAI_API_KEY: 'sk-test' }),
    ).not.toThrow()
    expect(() =>
      loadEnv({ ENABLE_RECEIPT_EXTRACT: 'true', GEMINI_API_KEY: 'gem-test' }),
    ).not.toThrow()
  })

  it('still requires an OpenAI key for the category reader', () => {
    expect(() =>
      loadEnv({ ENABLE_CATEGORY_EXTRACT: 'true', GEMINI_API_KEY: 'gem-test' }),
    ).toThrow(/OPENAI_API_KEY/)
  })

  it('trims the Gemini key and defaults its model', () => {
    const env = loadEnv({ GEMINI_API_KEY: ' gem-test\r' })
    expect(env.GEMINI_API_KEY).toBe('gem-test')
    expect(env.GEMINI_MODEL_RECEIPT_EXTRACT).toBe('gemini-3.1-flash-lite')
  })
})
