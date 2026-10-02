import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { MAX_UPLOAD_BYTES } from '@/lib/image-upload'
import {
  uploadFileName,
  uploadMimeType,
  uploadPath,
  uploadsDir,
} from '@/lib/uploads'

/**
 * Expense documents stored in a local folder (UPLOADS_DIR) instead of S3.
 * PUT is the upload target handed out by /api/s3-upload, GET serves the file
 * back. Like the public S3 bucket this replaces, anyone holding the URL can
 * read the file — the generated names are unguessable, nothing more.
 */
type Context = { params: Promise<{ name: string }> }

const notFound = () => new Response('Not found', { status: 404 })

async function resolve(context: Context) {
  const dir = uploadsDir()
  const name = uploadFileName((await context.params).name)
  return dir && name ? { dir, name, path: uploadPath(dir, name) } : null
}

export async function PUT(req: Request, context: Context) {
  const target = await resolve(context)
  if (!target) return notFound()

  // The request's own Content-Type is ignored: what we serve the file back as
  // is decided by its extension, which `uploadFileName` has already limited to
  // the image types we store.
  const body = Buffer.from(await req.arrayBuffer())
  if (body.byteLength > MAX_UPLOAD_BYTES) {
    return new Response('Payload too large', { status: 413 })
  }

  await mkdir(target.dir, { recursive: true })
  try {
    // 'wx' so a name can only ever be written once: a caller holding someone
    // else's document URL cannot replace the image behind it.
    await writeFile(target.path, body, { flag: 'wx' })
  } catch {
    return new Response('Already exists', { status: 409 })
  }
  return new Response(null, { status: 204 })
}

export async function GET(req: Request, context: Context) {
  const target = await resolve(context)
  if (!target) return notFound()

  try {
    const file = await readFile(/*turbopackIgnore: true*/ target.path)
    return new Response(new Uint8Array(file), {
      headers: {
        'Content-Type': uploadMimeType(target.name),
        // The names are generated per upload, so a stored file never changes.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return notFound()
  }
}
