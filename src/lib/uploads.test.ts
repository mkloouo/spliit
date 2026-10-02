import { env } from './env'
import { UPLOADS_BUCKET, UPLOADS_ENDPOINT } from './image-upload'
import {
  newUploadFileName,
  uploadFileName,
  uploadFileNameFromUrl,
  uploadMimeType,
} from './uploads'

// `uploadsDir()` reads UPLOADS_DIR off `env` live, so a mutable mock is enough.
jest.mock('./env', () => ({ env: {} }))

const mockEnv = env as { UPLOADS_DIR?: string }

beforeEach(() => {
  mockEnv.UPLOADS_DIR = '/data/uploads'
})
afterEach(() => {
  delete mockEnv.UPLOADS_DIR
})

describe('uploadFileName', () => {
  it('accepts a generated document name', () => {
    expect(uploadFileName('document-123-abc.jpg')).toBe('document-123-abc.jpg')
  })

  it('accepts the extensions we serve, case-insensitively', () => {
    expect(uploadFileName('a.JPEG')).toBe('a.JPEG')
    expect(uploadFileName('a.PNG')).toBe('a.PNG')
    expect(uploadMimeType('a.JPEG')).toBe('image/jpeg')
    expect(uploadMimeType('a.PNG')).toBe('image/png')
  })

  it('rejects path traversal and nested paths', () => {
    expect(uploadFileName('..')).toBeNull()
    expect(uploadFileName('../../etc/passwd.png')).toBeNull()
    expect(uploadFileName('sub/dir.png')).toBeNull()
    expect(uploadFileName('..%2Fx.png')).toBeNull()
    expect(uploadFileName('/absolute.png')).toBeNull()
    expect(uploadFileName('.hidden.png')).toBeNull()
  })

  it('rejects file types we do not store', () => {
    expect(uploadFileName('script.js')).toBeNull()
    expect(uploadFileName('page.html')).toBeNull()
    expect(uploadFileName('noextension')).toBeNull()
    expect(uploadFileName('receipt.png.js')).toBeNull()
  })
})

describe('newUploadFileName', () => {
  it('keeps the image extension and nothing else from the given name', () => {
    const name = newUploadFileName('../../Holiday Receipt.PNG')
    expect(name).not.toBeNull()
    expect(name).toMatch(/^document-\d+-[0-9a-f-]{36}\.png$/)
    // Whatever it generates has to survive the check used when serving it.
    expect(uploadFileName(name!)).toBe(name)
  })

  it('refuses anything that is not a JPEG or PNG', () => {
    expect(newUploadFileName('receipt.pdf')).toBeNull()
    expect(newUploadFileName('receipt')).toBeNull()
  })
})

describe('uploadFileNameFromUrl', () => {
  it('reads back a URL composed the way the uploader composes it', () => {
    const name = newUploadFileName('receipt.jpg')!
    // next-s3-upload builds `${endpoint}/${bucket}/${key}` after the upload.
    const url = `${UPLOADS_ENDPOINT}/${UPLOADS_BUCKET}/${name}`
    expect(uploadFileNameFromUrl(url)).toBe(name)
  })

  it('ignores URLs that are not local uploads', () => {
    expect(uploadFileNameFromUrl('/api/uploads/../../secret.png')).toBeNull()
    expect(uploadFileNameFromUrl('/other/path.png')).toBeNull()
    expect(
      uploadFileNameFromUrl('https://evil.example.com/api/uploads/x.png'),
    ).toBeNull()
  })

  it('claims nothing when no uploads folder is configured', () => {
    delete mockEnv.UPLOADS_DIR
    expect(uploadFileNameFromUrl('/api/uploads/document-1-a.png')).toBeNull()
  })
})
