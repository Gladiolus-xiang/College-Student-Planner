/** 截图识别：把图片压到合理尺寸再转 base64，直接内联进请求 */

export const VISION_MODEL = 'deepseek-flash'

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

/**
 * 压到最长边 1600px、JPEG 0.85。
 * 模型端本来也会缩放到约 1300×1300，这里提前压是为了减小上传体积和等待时间。
 */
export async function fileToDataUrl(file: File, maxEdge = 1600): Promise<string> {
  const bitmap = await createImageBitmap(file)
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
  bitmap.close?.()

  return canvas.toDataURL('image/jpeg', 0.85)
}
