import { GEMINI_API_KEY_MASK, geminiApiKeyUpdate } from './gemini-key'

describe('geminiApiKeyUpdate', () => {
  it('leaves the stored key alone when the field was not touched', () => {
    expect(geminiApiKeyUpdate(GEMINI_API_KEY_MASK)).toBeUndefined()
    expect(geminiApiKeyUpdate(undefined)).toBeUndefined()
  })

  it('removes the key when the field is cleared', () => {
    expect(geminiApiKeyUpdate('')).toBeNull()
    expect(geminiApiKeyUpdate('   ')).toBeNull()
  })

  it('stores a new key, trimmed', () => {
    expect(geminiApiKeyUpdate('  AIzaNEW  ')).toBe('AIzaNEW')
  })
})
