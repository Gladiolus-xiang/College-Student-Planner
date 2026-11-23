/**
 * 浏览器端回归：录入一条「马上截止」的事，两件事都得对
 *   1. 计划不许把它排到截止之后（原来排到 20:15–21:15）
 *   2. 提醒时刻早就过了，但截止只剩 1–2 分钟时，必须立刻弹一条提醒
 *
 * 跑法（需要 dev server 在跑）：node scripts/e2e-deadline-reminder.mjs
 */
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const URL = 'http://localhost:5173'
const SHOT = 'D:/AIGC/deliverables/assets/test/e2e-deadline-reminder.png'

mkdirSync('D:/AIGC/deliverables/assets/test', { recursive: true })

const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox'] })
const context = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 })
const page = await context.newPage()

const consoleErrors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text())
})
page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`))

let failed = 0
const check = (name, ok, extra = '') => {
  if (!ok) failed += 1
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
}

const pad = (n) => String(n).padStart(2, '0')

try {
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  // 造一条「2 分钟后截止、提前 2 小时提醒」的活动，等价于 20:05 录入 20:06 截止
  await page.evaluate(() => {
    const p = (n) => String(n).padStart(2, '0')
    const due = new Date(Date.now() + 2 * 60_000)
    const deadline = `${due.getFullYear()}-${p(due.getMonth() + 1)}-${p(due.getDate())} ${p(due.getHours())}:${p(due.getMinutes())}`
    localStorage.clear()
    localStorage.setItem(
      'today-schedule-items-v1',
      JSON.stringify([
        {
          id: 'ddl-now',
          title: '高数作业',
          type: 'ddl',
          deadline,
          durationMin: 60,
          priority: 1,
          remindBeforeMin: 120,
          source: 'ai',
          status: 'todo',
        },
      ]),
    )
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  // 1. 提醒：进页面就该弹一条「还有 N 分钟：高数作业」
  const toast = page.getByText(/还有 \d+ 分钟：高数作业/)
  await toast.waitFor({ timeout: 15_000 })
  check('截止只剩几分钟时立刻提醒', await toast.isVisible(), await toast.first().innerText())

  // 2. 计划：不许出现任何 [20:15–21:15] 这种截止之后的块
  const plan = page.locator('section', { hasText: '自动排期' })
  const ranges = await plan.locator('text=/\\d{2}:\\d{2}–\\d{2}:\\d{2}/').count()
  const deadlineText = await page.getByText(/截止 \d{4}-\d{2}-\d{2} \d{2}:\d{2}/).first().innerText()
  const deadlineHHMM = deadlineText.slice(-5)
  check('没排出截止之后的块', ranges === 0, `${ranges} 个时间段，截止 ${deadlineHHMM}`)

  // 3. 没排上的原因要说清
  const reason = page.getByText(/离截止只剩 \d+ 分钟|截止时间已过/)
  await reason.waitFor({ timeout: 5_000 })
  check('没排上时说明原因', await reason.isVisible(), await reason.first().innerText())

  await page.screenshot({ path: SHOT, fullPage: true })
  check('控制台没有报错', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))
} catch (err) {
  failed += 1
  console.error('✗ 流程中断：', err instanceof Error ? err.message : err)
  await page.screenshot({ path: SHOT, fullPage: true }).catch(() => {})
} finally {
  await browser.close()
}

console.log(failed ? `\n${failed} 项失败` : '\n全部通过')
process.exit(failed ? 1 : 0)
