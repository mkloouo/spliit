/**
 * How a group's own Gemini key travels through the settings form.
 *
 * The key never leaves the server (see `getGroup`), so the form cannot show
 * the saved value back. It shows this mask instead, and sends it back
 * unchanged when the user did not touch the field.
 */
export const GEMINI_API_KEY_MASK = '••••••••••••'

/** The longest key we store. Gemini's are ~40 characters. */
export const GEMINI_API_KEY_MAX = 200

/**
 * What the form's value means for the stored key:
 * - the mask, or nothing at all, leaves it as it is (`undefined`, which a
 *   Prisma update skips)
 * - an empty field removes it (`null`)
 * - anything else replaces it
 */
export function geminiApiKeyUpdate(
  value: string | undefined,
): string | null | undefined {
  if (value === undefined || value === GEMINI_API_KEY_MASK) return undefined
  const key = value.trim()
  return key === '' ? null : key
}
