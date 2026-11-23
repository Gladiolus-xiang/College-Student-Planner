/** 截图识别：把图片压到合理尺寸再转 base64，直接内联进请求 */

export const VISION_MODEL = 'deepseek-flash'

/** 线上代理是边缘函数，请求体上限 1 MB —— base64 后要留足余量，否则大图会被挡在门外 */
const MAX_DATA_URL_CHARS = 820_000

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

function encode(bitmap: ImageBitmap, maxEdge: number, quality: number): string {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前浏览器无法处理图片')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)

  return canvas.toDataURL('image/jpeg', quality)
}

/**
 * 压到最长边 1280px、JPEG 0.82 再上传。
 * 模型端本来也会缩到约 1300×1300，所以这个尺寸不损失识别率，只减少上传时间和体积；
 * 万一张图还是太大，再降一档重压一次，仍超标才报错让用户裁剪。
 */
export async function fileToDataUrl(file: File, maxEdge = 1280): Promise<string> {
  const bitmap = await createImageBitmap(file)
  try {
    let dataUrl = encode(bitmap, maxEdge, 0.82)
    if (dataUrl.length > MAX_DATA_URL_CHARS) dataUrl = encode(bitmap, 1000, 0.7)
    if (dataUrl.length > MAX_DATA_URL_CHARS) {
      throw new Error('这张图太大，识别服务放不下。先裁剪到只剩通知或课表部分，再试一次')
    }
    return dataUrl
  } finally {
    bitmap.close?.()
  }
}
