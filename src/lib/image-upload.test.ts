import {
  asJpegFile,
  downscaleImage,
  isDocumentUrl,
  MAX_UPLOAD_BYTES,
} from './image-upload'

// The canvas path needs a real browser, so what is checked here is the two
// things that break silently: the name/type a re-encoded image gets, and that
// an image small enough is handed back exactly as it came in.

describe('asJpegFile', () => {
  it('renames to .jpg and declares the JPEG type', () => {
    const file = asJpegFile(new Blob(['x']), 'Holiday Receipt.PNG')
    expect(file.name).toBe('Holiday Receipt.jpg')
    expect(file.type).toBe('image/jpeg')
  })

  it('handles a name with no extension, and one with nothing but', () => {
    expect(asJpegFile(new Blob(['x']), 'receipt').name).toBe('receipt.jpg')
    expect(asJpegFile(new Blob(['x']), '.png').name).toBe('image.jpg')
  })

  it('leaves dots inside the name alone', () => {
    expect(asJpegFile(new Blob(['x']), 'receipt.v2.png').name).toBe(
      'receipt.v2.jpg',
    )
  })
})

describe('downscaleImage', () => {
  it('returns a small enough file untouched', async () => {
    const file = new File(['small'], 'receipt.png', { type: 'image/png' })
    expect(await downscaleImage(file)).toBe(file)
  })

  it('returns the original when the image cannot be decoded', async () => {
    const file = new File(
      [new Uint8Array(MAX_UPLOAD_BYTES + 1)],
      'receipt.png',
      { type: 'image/png' },
    )
    // jsdom has no createImageBitmap, which is the same situation as a browser
    // that cannot decode the file: the caller gets it back and reports its size.
    expect(await downscaleImage(file)).toBe(file)
  })
})

describe('isDocumentUrl', () => {
  it('accepts a locally stored document’s path', () => {
    expect(isDocumentUrl('/api/uploads/document-1-abc.jpg')).toBe(true)
  })

  it('accepts an http(s) URL, wherever it is stored', () => {
    expect(
      isDocumentUrl('https://bucket.s3.eu-north-1.amazonaws.com/doc.png'),
    ).toBe(true)
    expect(isDocumentUrl('http://minio.example.com/bucket/doc.png')).toBe(true)
  })

  it('rejects other schemes and anything unparseable', () => {
    expect(isDocumentUrl('javascript:alert(1)')).toBe(false)
    expect(isDocumentUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(false)
    expect(isDocumentUrl('not a url')).toBe(false)
    expect(isDocumentUrl('')).toBe(false)
  })

  it('rejects a path that only looks like the uploads one', () => {
    expect(isDocumentUrl('/api/uploadsfoo/doc.png')).toBe(false)
    expect(isDocumentUrl('/uploads/doc.png')).toBe(false)
  })
})
