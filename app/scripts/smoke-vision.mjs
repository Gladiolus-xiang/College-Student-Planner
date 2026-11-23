/**
 * 识图链路冒烟测试：把本地截图发给视觉模型，看能不能拆出活动 / 课程。
 * 用法：node scripts/smoke-vision.mjs chat      （群通知）
 *       node scripts/smoke-vision.mjs timetable  （课表）
 */
import { readFile } from 'node:fs/promises'

import { buildCourseImageMessages, buildNoticeImageMessages } from '../src/lib/prompts.ts'

const kind = process.argv[2] ?? 'chat'
const file = kind === 'timetable'
  ? 'D:/AIGC/deliverables/assets/test/timetable.png'
  : 'D:/AIGC/deliverables/assets/test/chat.png'

const now = new Date()
const p = (n) => String(n).padStart(2, '0')
const today = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}（星期${'日一二三四五六'[now.getDay()]}）`

const base64 = (await readFile(file)).toString('base64')
const system = kind === 'timetable' ? buildCourseImageMessages()[0] : buildNoticeImageMessages(today)[0]

const res = await fetch('http://localhost:5173/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'deepseek-flash',
    json: true,
    messages: [
      system,
      {
        role: 'user',
        content: [
          { type: 'text', text: kind === 'timetable' ? '这是课表截图。' : '这是群聊截图，提取时间安排。' },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${base64}`, detail: 'high' } },
        ],
      },
    ],
  }),
})

const data = await res.json()
if (!res.ok) {
  console.error(`HTTP ${res.status}`, data)
  process.exit(1)
}
console.log(`model=${data.model} ms=${data.ms} tokens=${data.usage?.total_tokens}`)
console.log(data.content)
