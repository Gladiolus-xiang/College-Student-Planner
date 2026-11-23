/**
 * 浏览器端回归：习惯类按原文钟点开始。
 * 起因：输入「晚上8点去跑步」，计划里排成 19:00–20:00，看起来像「8 点截止」。
 *
 * 跑法（需要 dev server 在跑）：
 *   node scripts/e2e-habit-time.mjs
 */
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const URL = 'http://localhost:5173'
const SHOT = 'D:/AIGC/deliverables/assets/test/e2e-habit-time.png'

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

try {
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem(
      'today-schedule-items-v1',
      JSON.stringify([
        {
          id: 'h-run',
          title: '跑步',
          type: 'habit',
          deadline: null,
          durationMin: 60,
          priority: 2,
          remindBeforeMin: 60,
          preferStart: '20:00',
          source: 'ai',
          status: 'todo',
        },
      ]),
    )
  })
  await page.reload({ waitUntil: 'domcontentloaded' })

  const plan = page.locator('section', { hasText: '自动排期' })
  const result = page.locator('section', { hasText: '解析结果' })

  const runCard = plan.locator('li', { hasText: '跑步' }).first()
  await runCard.waitFor({ timeout: 10_000 })
  const card = await runCard.innerText()

  check('计划卡片从 20:00 开始', card.includes('20:00–21:00'), card.split('\n').join(' / '))
  check('没有把 8 点当成结束时间（不出现 19:00）', !card.includes('19:00'), card.split('\n').join(' / '))

  const row = await result.locator('li', { hasText: '跑步' }).first().innerText()
  check('活动列表写「每天 20:00 开始」', row.includes('每天 20:00 开始'), row.split('\n').join(' / '))
  check('活动列表不写「截止」', !row.includes('截止'), row.split('\n').join(' / '))

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
