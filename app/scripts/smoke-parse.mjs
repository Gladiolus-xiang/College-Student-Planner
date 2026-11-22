/**
 * Prompt 冒烟测试：改完 src/lib/prompts.ts 就跑一次，看模型到底吐出什么。
 * 用法：先确保 dev server 在跑，然后  node scripts/smoke-parse.mjs
 */
import { buildParseMessages } from '../src/lib/prompts.ts'

const SAMPLE = [
  '下周三晚上8点前交《机器学习》实验报告，大概要写3小时。',
  '周五下午2点英语四级模拟考。',
  '每天背50个单词。',
  '12月12日上午9点四级正式考试。',
].join('\n')

const now = new Date()
const pad = (n) => String(n).padStart(2, '0')
const iso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
const label = `${iso}（星期${'日一二三四五六'[now.getDay()]}）`

const res = await fetch('http://localhost:5173/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages: buildParseMessages(SAMPLE, label), json: true }),
})

const data = await res.json()
if (!res.ok) {
  console.error(`HTTP ${res.status}:`, data)
  process.exit(1)
}
console.log(`model=${data.model} ms=${data.ms} tokens=${data.usage?.total_tokens}`)
console.log(data.content)
