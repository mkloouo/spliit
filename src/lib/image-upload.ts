/**
 * What both sides of an upload agree on: how big an image may be, where a
 * locally stored one is served from, and the browser-side shrinking that keeps
 * photos under the limit. Deliberately free of `node:` and of `env`, so the
 * form schema and the client components can import it too.
 */

/**
 * The largest image the app uploads or stores. The client shrinks anything
 * bigger to fit (see `downscaleImage`), and the server refuses what still
 * does not.
 */
export const MAX_UPLOAD_BYTES = 5 * 1024 ** 2

// Where the app serves locally stored documents from. next-s3-upload's
// presigned flow composes a file's final URL as `${endpoint}/${bucket}/${key}`,
// so the local upload route is handed out split along those lines (see
// src/app/api/s3-upload/route.ts).
export const UPLOADS_ENDPOINT = '/api'
export const UPLOADS_BUCKET = 'uploads'
export const UPLOADS_URL_PREFIX = `${UPLOADS_ENDPOINT}/${UPLOADS_BUCKET}/`

/**
 * Where an expense document is allowed to live: an http(s) URL — S3, or
 * whatever storage the document was saved with — or the app-relative path a
 * locally stored one is served under.
 *
 * Shape only. That the file exists, and is one the app itself wrote, is
 * checked where it matters: `uploadFileName` when serving it, and
 * `isAllowedUploadUrl` before any of it reaches a model.
 */
export function isDocumentUrl(value: string): boolean {
  if (value.startsWith(UPLOADS_URL_PREFIX)) return true
  try {
    const { protocol } = new URL(value)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

/** The longest edge we keep. A receipt is legible well below this. */
const MAX_EDGE = 2400

/**
 * A re-encoded image has to be named `.jpg`: both upload paths derive the
 * stored file's type from its extension, so a JPEG called `.png` would be
 * served as `image/png` and — with `X-Content-Type-Options: nosniff` — not
 * render at all.
 */
export function asJpegFile(blob: Blob, originalName: string) {
  const base = originalName.replace(/\.[^./\\]*$/, '') || 'image'
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg' })
}

async function encodeJpeg(bitmap: ImageBitmap, scale: number, quality: number) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))

  const context = canvas.getContext('2d')
  if (!context) return null
  // JPEG has no alpha channel: without this, a transparent PNG comes out with
  // a black background.
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  )
}

/**
 * Shrinks an image until it fits `maxBytes`, by capping its longest edge and
 * re-encoding it as JPEG.
 *
 * Returns the file untouched when it already fits, and the smallest attempt
 * when even the hardest one does not — the caller checks the size it got back
 * and reports a file that is still too big, as it did before any of this.
 */
export async function downscaleImage(
  file: File,
  maxBytes = MAX_UPLOAD_BYTES,
): Promise<File> {
  if (file.size <= maxBytes) return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    // Not decodable here (an unsupported format, or a browser without
    // createImageBitmap): hand the original back rather than failing the
    // upload with a decoding error.
    return file
  }

  try {
    let scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    let smallest = file

    // Each attempt shrinks further and compresses harder; five is enough to
    // bring a photo from any current phone camera under 5 MB.
    for (const quality of [0.85, 0.8, 0.7, 0.6, 0.5]) {
      const blob = await encodeJpeg(bitmap, scale, quality)
      if (!blob) break
      if (blob.size < smallest.size) smallest = asJpegFile(blob, file.name)
      if (blob.size <= maxBytes) return asJpegFile(blob, file.name)
      scale *= 0.75
    }

    return smallest
  } finally {
    bitmap.close()
  }
}
