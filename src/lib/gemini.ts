import { env } from './env'

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

/** How long to wait for Gemini before giving up on a receipt. */
const TIMEOUT_MS = 30_000

/** The largest image we will inline into a request, to bound memory and spend. */
const MAX_IMAGE_BYTES = 10 * 1024 ** 2

/**
 * The model's answer is the text of its non-thought parts. Reading `parts[0]`
 * alone breaks on models that put a thought (or a thought signature) first.
 */
function answerText(body: any): string {
  const parts: any[] = body?.candidates?.[0]?.content?.parts ?? []
  return parts
    .filter((part) => typeof part?.text === 'string' && !part.thought)
    .map((part) => part.text)
    .join('')
}

/**
 * Downloads an image so it can be inlined into a Gemini request.
 *
 * Unlike OpenAI's `image_url`, Gemini does not fetch the image itself, so the
 * app has to. The caller is responsible for checking the URL is one of our own
 * uploads first (see `isAllowedUploadUrl`).
 */
export async function fetchImageAsInlineData(url: string) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`Could not download the image: HTTP ${response.status}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('The image is too large to send to Gemini.')
  }
  const mimeType = response.headers.get('content-type')?.split(';')[0]
  return {
    mime_type:
      mimeType && mimeType.startsWith('image/') ? mimeType : 'image/jpeg',
    data: buffer.toString('base64'),
  }
}

/**
 * Asks Gemini to read an image and answer as JSON matching `schema`.
 *
 * Returns the parsed answer, or `null` when the model answered with something
 * that is not the JSON it was asked for — the caller reports "nothing
 * extracted" rather than filling a form with guesses.
 */
export async function generateJsonFromImage({
  prompt,
  schema,
  image,
}: {
  prompt: string
  schema: Record<string, unknown>
  image: { mime_type: string; data: string }
}): Promise<unknown | null> {
  const apiKey = env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set.')
  }

  const call = (withSchema: boolean) =>
    fetch(`${API_BASE}/${env.GEMINI_MODEL_RECEIPT_EXTRACT}:generateContent`, {
      method: 'POST',
      // The key goes in a header, not the query string, where proxies and logs
      // keep URLs.
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: image }] }],
        // Without a schema the model answers in its own shape and every field
        // the app reads comes back empty.
        generationConfig: withSchema
          ? {
              responseMimeType: 'application/json',
              responseJsonSchema: schema,
            }
          : { responseMimeType: 'application/json' },
      }),
    })

  let response = await call(true)
  // A model or API version that rejects the schema answers 400; the prompt
  // alone still names every field, so try once more without it rather than
  // failing the receipt.
  if (response.status === 400) response = await call(false)
  if (!response.ok) {
    throw new Error(`Gemini returned HTTP ${response.status}`)
  }

  try {
    return JSON.parse(answerText(await response.json()))
  } catch {
    return null
  }
}
