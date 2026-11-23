/**
 * 识图链路回归：同一套提示词，自己判断图里是课表还是群通知。
 * 用法（需要 dev server）：node scripts/smoke-vision.mjs
 */
import { readFile } from 'node:fs/promises'

import { buildScreenshotMessages } from '../src/lib/prompts.ts'

const targets = [
  { file: 'D:/AIGC/deliverables/assets/test/timetable.png', expect: 'course' },
  { file: 'D:/AIGC/deliverables/assets/test/chat.png', expect: 'notice' },
]

const now = new Date()
const p = (n) => String(n).padStart(2, '0')
const today = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}（星期${'日一二三四五六'[now.getDay()]}）`

let failed = 0
for (const target of targets) {
  const base64 = (await readFile(target.file)).toString('base64')
  const res = await fetch('http://localhost:5173/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-flash',
      json: true,
      messages: [
        buildScreenshotMessages(today)[0],
        {
          role: 'user',
          content: [
            { type: 'text', text: '这张截图是课表还是群通知？按对应格式解析。' },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${base64}`, detail: 'high' } },
          ],
        },
      ],
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    console.error(`HTTP ${res.status}`, data)
    failed += 1
    continue
  }

  const text = String(data.content)
  const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
  const count = parsed.courses?.length ?? parsed.activities?.length ?? 0
  const ok = parsed.kind === target.expect && count > 0
  if (!ok) failed += 1
  console.log(
    `${ok ? '✓' : '✗'} ${target.file.split('/').pop()} → kind=${parsed.kind}（期望 ${target.expect}），${count} 条，${data.ms}ms`,
  )
}

console.log(failed ? `\n${failed} 项失败` : '\n全部通过')
process.exit(failed ? 1 : 0)
