import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { env } from './env'

/** Largest upload we store, mirroring the client-side check. */
export const MAX_UPLOAD_BYTES = 5 * 1024 ** 2

/** The image types the upload input accepts, and nothing else. */
const MIME_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
}

// next-s3-upload's presigned flow composes a file's final URL as
// `${endpoint}/${bucket}/${key}`, so the local storage route is handed out
// split along those lines (see src/app/api/s3-upload/route.ts).
export const UPLOADS_ENDPOINT = '/api'
export const UPLOADS_BUCKET = 'uploads'
export const UPLOADS_URL_PREFIX = `${UPLOADS_ENDPOINT}/${UPLOADS_BUCKET}/`

/**
 * The folder expense documents are stored in, or null when they go to S3.
 * Read live rather than captured at import, so the environment does not have
 * to be complete before this module is first imported.
 */
export const uploadsDir = () => env.UPLOADS_DIR || null

/**
 * Where a validated upload name lives on disk. Wrapped in a function so the
 * `join` does not sit in an `fs` call's argument list, which makes Turbopack
 * trace the whole project into the standalone output.
 */
export const uploadPath = (dir: string, name: string) => join(dir, name)

const extensionOf = (name: string) =>
  name.match(/\.[^./\\]+$/)?.[0].toLowerCase() ?? ''

/**
 * The names we are willing to touch inside the uploads folder: a single path
 * segment of safe characters ending in a known image extension. Every path
 * that reaches the filesystem goes through here, so `..`, nested paths and
 * surprise file types cannot.
 */
export function uploadFileName(name: string): string | null {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)) return null
  return extensionOf(name) in MIME_BY_EXTENSION ? name : null
}

export const uploadMimeType = (name: string) =>
  MIME_BY_EXTENSION[extensionOf(name)]

/** A fresh name to store `filename` under, or null if we do not store it. */
export function newUploadFileName(filename: string): string | null {
  const extension = extensionOf(filename)
  if (!(extension in MIME_BY_EXTENSION)) return null
  return `document-${Date.now()}-${randomUUID()}${extension}`
}

/** The file a local upload URL points at, or null for any other URL. */
export function uploadFileNameFromUrl(url: string): string | null {
  if (!uploadsDir() || !url.startsWith(UPLOADS_URL_PREFIX)) return null
  return uploadFileName(url.slice(UPLOADS_URL_PREFIX.length))
}

/**
 * Reads a locally stored upload for a vision model, in the shape Gemini's
 * `inline_data` wants. Returns null when the URL is not one of ours, so the
 * caller can fall back to downloading it.
 */
export async function readUploadAsInlineData(url: string) {
  const dir = uploadsDir()
  const name = uploadFileNameFromUrl(url)
  if (!dir || !name) return null

  const file = await readFile(/*turbopackIgnore: true*/ uploadPath(dir, name))
  if (file.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error('The image is too large to send to a model.')
  }
  return { mime_type: uploadMimeType(name), data: file.toString('base64') }
}
