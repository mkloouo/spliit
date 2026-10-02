'use server'

import { getCategories, getGroupGeminiApiKey } from '@/lib/api'
import { env } from '@/lib/env'
import { getRuntimeFeatureFlags } from '@/lib/featureFlags'
import { fetchImageAsInlineData, generateJsonFromImage } from '@/lib/gemini'
import { getOpenAIClient } from '@/lib/openai'
import { isAllowedUploadUrl } from '@/lib/uploaded-image-url'
import { readUploadAsInlineData } from '@/lib/uploads'
import { formatCategoryForAIPrompt } from '@/lib/utils'
import { z } from 'zod'

/** How many line items we are willing to read off a single receipt. */
const MAX_ITEMS = 100

// The model is contractually bound to this shape by `strict: true` (OpenAI) or
// `responseJsonSchema` (Gemini), but the response is still parsed rather than
// trusted: a self-hosted or older endpoint may ignore the schema.
const receiptResponseSchema = z.object({
  amount: z.number(),
  categoryId: z.string(),
  date: z.string(),
  title: z.string(),
  items: z
    .array(z.object({ title: z.string(), amount: z.number() }))
    .default([]),
})

/**
 * The shape both providers are asked to answer in. Every property is required
 * and no others are allowed, which is what OpenAI's `strict: true` demands;
 * Gemini accepts the same document.
 */
const responseJsonSchema = {
  type: 'object',
  properties: {
    amount: { type: 'number' },
    categoryId: { type: 'string' },
    date: { type: 'string' },
    title: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          amount: { type: 'number' },
        },
        required: ['title', 'amount'],
        additionalProperties: false,
      },
    },
  },
  required: ['amount', 'categoryId', 'date', 'title', 'items'],
  additionalProperties: false,
} as const

function receiptPrompt(
  categories: { id: number; grouping: string; name: string }[],
) {
  return `
This image contains a receipt.
Read the total amount and store it as a non-formatted number without any other text or currency.
Then guess the category for this receipt among the following categories and store its ID: ${categories.map(
    (category) => formatCategoryForAIPrompt(category),
  )}.
Guess the expense’s date and store it as yyyy-mm-dd.
Guess a title for the expense.
Read every purchased line item into \`items\`, in the order they are printed:
- \`title\`: the product name, tidied up for someone reading it later. Keep the
  receipt's own language and anything that identifies the product — the brand,
  the variety, the size or weight. Write it in ordinary sentence case instead of
  all capitals, separate words that the receipt ran together, put a space
  between a number and its unit, and expand an abbreviation only when you are
  sure what it stands for. Drop what identifies the line to the till rather than
  to a person: a trailing tax-class letter, an article or PLU number, a
  repeated store name. Never replace a word you cannot read with a guess —
  leave it as printed.
  For example \`PIZZA WYNOS TEX-MEX 492g-B\` becomes \`Pizza wynos Tex-Mex 492 g\`,
  and \`JabłSuszAnanas80g\` becomes \`Jabłka suszone ananas 80 g\`.
- \`amount\`: the price printed for that line, as a non-formatted number. For a
  line with a quantity, this is the line total, not the unit price.
A line that discounts another line — a rebate, a loyalty price, a coupon,
printed under the product it applies to — is not an item of its own. Subtract it
from that product's line and return the one discounted price, so a 8.99 line
followed by a -1.49 rebate is a single item at 7.50.
Read nothing into \`items\` that the receipt is adding up rather than selling:
subtotals, a total of all discounts, tax or VAT lines, a payment or change line,
or the grand total. These restate figures that are already in the lines above
them, and counting them again makes the items disagree with the total. Only what
the shopper actually put in the basket is an item.
Do not invent items, prices or dates that cannot be read from the image, and do
not reconstruct a price the receipt does not print. Return an empty \`items\`
list if no line items are legible. The items do not have to add up to the
total — a receipt may also carry tax or tips.`
}

async function extractWithGemini(
  apiKey: string,
  imageUrl: string,
  prompt: string,
) {
  // A locally stored document is read off disk; anything else is downloaded.
  const image =
    (await readUploadAsInlineData(imageUrl)) ??
    (await fetchImageAsInlineData(imageUrl))
  return generateJsonFromImage({
    apiKey,
    prompt,
    schema: responseJsonSchema,
    image,
  })
}

async function extractWithOpenAI(imageUrl: string, prompt: string) {
  // OpenAI fetches `image_url` itself, which a locally stored document behind
  // this app is not reachable for, so that one is inlined as a data URL.
  const local = await readUploadAsInlineData(imageUrl)
  const url = local ? `data:${local.mime_type};base64,${local.data}` : imageUrl
  const openai = getOpenAIClient()
  const completion = await openai.chat.completions.create({
    model: env.OPENAI_MODEL_RECEIPT_EXTRACT,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'receipt_response',
        strict: true,
        schema: responseJsonSchema,
      },
    },
    messages: [
      { role: 'user', content: [{ type: 'text', text: prompt }] },
      {
        role: 'user',
        content: [{ type: 'image_url', image_url: { url } }],
      },
    ],
  })
  const messageContent = completion.choices.at(0)?.message.content
  if (!messageContent) return null
  try {
    return JSON.parse(messageContent)
  } catch {
    return null
  }
}

export async function extractExpenseInformationFromImage(
  groupId: string,
  imageUrl: string,
) {
  'use server'

  // Enforce the feature flag server-side: the UI gate only hides the button, it
  // does not prevent the action endpoint from being invoked directly.
  const { enableReceiptExtract } = await getRuntimeFeatureFlags()
  if (!enableReceiptExtract) {
    throw new Error('Receipt extraction is not enabled.')
  }

  // Only extract from images the app itself uploaded. Without this, an arbitrary
  // caller-supplied URL is forwarded to the model, enabling SSRF-via-OpenAI and
  // unbounded API spend.
  if (!isAllowedUploadUrl(imageUrl)) {
    throw new Error('Invalid image URL.')
  }

  const categories = await getCategories()
  const prompt = receiptPrompt(categories)

  // The group's own key first, then the instance-wide one.
  const geminiApiKey =
    (await getGroupGeminiApiKey(groupId)) ?? env.GEMINI_API_KEY

  if (!geminiApiKey && !env.OPENAI_API_KEY) {
    throw new Error(
      'No key to read the receipt with: set one in the group settings, or GEMINI_API_KEY / OPENAI_API_KEY on the server.',
    )
  }

  // Gemini when a key for it is available, OpenAI otherwise.
  const raw = geminiApiKey
    ? await extractWithGemini(geminiApiKey, imageUrl, prompt)
    : await extractWithOpenAI(imageUrl, prompt)

  const parsed = (() => {
    try {
      return receiptResponseSchema.parse(raw)
    } catch {
      // Malformed or schema-violating output: report "nothing extracted"
      // rather than passing junk on to the expense form.
      return null
    }
  })()

  const amount = Number(parsed?.amount)
  return {
    amount: Number.isFinite(amount) ? amount : null,
    categoryId: parsed?.categoryId ?? null,
    date: parsed?.date ?? null,
    title: parsed?.title ?? null,
    items: (parsed?.items ?? [])
      .filter(
        (item) => item.title.trim() !== '' && Number.isFinite(item.amount),
      )
      .slice(0, MAX_ITEMS)
      .map((item) => ({ title: item.title.trim(), amount: item.amount })),
  }
}

export type ReceiptExtractedInfo = Awaited<
  ReturnType<typeof extractExpenseInformationFromImage>
>
