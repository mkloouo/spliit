import { randomId } from '@/lib/api'
import { env } from '@/lib/env'
import {
  newUploadFileName,
  UPLOADS_BUCKET,
  UPLOADS_ENDPOINT,
  UPLOADS_URL_PREFIX,
  uploadsDir,
} from '@/lib/uploads'
import { POST as route } from 'next-s3-upload/route'
import type { NextRequest } from 'next/server'

const uploadToS3 = route.configure({
  key(req, filename) {
    const [, extension] = filename.match(/(\.[^\.]*)$/) ?? [null, '']
    const timestamp = new Date().toISOString()
    const random = randomId()
    return `document-${timestamp}-${random}${extension.toLowerCase()}`
  },
  endpoint: env.S3_UPLOAD_ENDPOINT,
  // forcing path style is only necessary for providers other than AWS
  forcePathStyle: !!env.S3_UPLOAD_ENDPOINT,
})

/**
 * Hands the uploader a target to PUT the file to.
 *
 * With UPLOADS_DIR set the file goes to a local folder, so we answer in the
 * same shape next-s3-upload's presigned flow expects, pointing at our own
 * /api/uploads/<name> route instead of a presigned S3 URL. That keeps the
 * client on a single upload path: the hook PUTs to `url`, then composes the
 * document's URL as `${endpoint}/${bucket}/${key}`, which is why those three
 * are split the way they are. Without UPLOADS_DIR this is upstream's S3
 * handler, unchanged.
 */
export async function POST(req: NextRequest) {
  if (!uploadsDir()) return uploadToS3(req)

  const { filename } = (await req.json()) as { filename?: unknown }
  const name = typeof filename === 'string' ? newUploadFileName(filename) : null
  if (!name) {
    return new Response('Only JPEG and PNG images can be stored', {
      status: 415,
    })
  }

  return Response.json({
    url: `${UPLOADS_URL_PREFIX}${name}`,
    key: name,
    bucket: UPLOADS_BUCKET,
    region: 'local',
    endpoint: UPLOADS_ENDPOINT,
  })
}
