/**
 * 浏览器端回归：导入课表之后，用户应该看见「本周课表」和一句「课表已就位」，
 * 而不是只有一个 toast、下面一片空白。
 *
 * 跑法（需要 dev server 在跑）：
 *   node scripts/e2e-course-import.mjs
 */
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const URL = 'http://localhost:5173'
const IMAGE = 'D:/AIGC/deliverables/assets/test/timetable.png'
const SHOT = 'D:/AIGC/deliverables/assets/test/e2e-course-import.png'

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
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'domcontentloaded' })

  // 空状态下应当先看到引导，而不是一片空白（默认带一份示例课表，文案里要说明是「示例」）
  check('首次打开有引导文案', await page.getByText(/这里就会出现未来几天的安排/).isVisible())
  check('示例课表有标注', await page.getByText(/示例课表/).first().isVisible())

  // 点唯一那个截图按钮，选一张课表
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 15_000 }),
    page.getByRole('button', { name: /贴截图识别/ }).click(),
  ])
  await chooser.setFiles(IMAGE)

  // 识别是真实调用视觉模型，给足时间
  await page.getByText(/识别到 \d+ 门课/).waitFor({ timeout: 90_000 })
  const toast = await page.getByText(/识别到 \d+ 门课/).first().innerText()
  check('弹出「识别到 N 门课」', /识别到 10 门课/.test(toast), toast.trim())

  await page.getByText('本周课表').waitFor({ timeout: 10_000 })
  const courseRows = await page.locator('section', { hasText: '本周课表' }).locator('li').count()
  check('页面出现「本周课表」并且列出课程', courseRows === 10, `${courseRows} 行`)

  const hint = await page.getByText(/课表 \d+ 门已就位/).isVisible().catch(() => false)
  check('没有任务时给出「课表已就位」的说明', hint)

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
