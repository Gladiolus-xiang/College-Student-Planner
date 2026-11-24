/**
 * 浏览器回归：非安全上下文（用 http 打开线上地址）里 `crypto.randomUUID` 不存在，
 * 页面不能因此崩掉——解析、排期、课表都得照常。
 *
 * 起因：部署后用 http 打开，点「AI 解析」弹出 "crypto.randomUUID is not a function"。
 *
 * 跑法（需要 dev server 在跑）：node scripts/e2e-http-fallback.mjs
 */
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const URL = 'http://localhost:5173'
const SHOT = 'D:/AIGC/deliverables/assets/test/e2e-http-fallback.png'

mkdirSync('D:/AIGC/deliverables/assets/test', { recursive: true })

const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox'] })
const context = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 })

// 模拟 http 打开的线上环境：浏览器不给 crypto.randomUUID
await context.addInitScript(() => {
  Object.defineProperty(globalThis.crypto, 'randomUUID', { value: undefined, configurable: true })
})

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

  check('随机 UUID 确实不可用（模拟生效）', await page.evaluate(() => typeof crypto.randomUUID !== 'function'))

  await page.getByLabel('原始文字').fill('明天下午2点交实验报告。')
  await page.getByRole('button', { name: /AI 解析/ }).click()

  const row = page.locator('section', { hasText: '解析结果' }).locator('li').first()
  await row.waitFor({ timeout: 60_000 })
  check('解析结果出来了', (await row.innerText()).includes('实验报告'), (await row.innerText()).split('\n').slice(0, 2).join(' '))

  const uuidError = await page.getByText(/crypto\.randomUUID/).count()
  check('没有 crypto.randomUUID 报错', uuidError === 0)

  // 排期也要能算出来（引擎里同样用到随机 id 的话会在这里炸）
  const plan = page.locator('section', { hasText: '自动排期' })
  await plan.waitFor({ timeout: 10_000 })
  check('排期出来了', (await plan.locator('li').count()) > 0)

  await page.screenshot({ path: SHOT, fullPage: true })
  check('控制台没有报错', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '))
} catch (err) {
  failed += 1
  console.error('✗ 流程中断：', err instanceof Error ? err.message : err)
  await page.screenshot({ path: SHOT, fullPage: true }).catch(() => {})
} finally {
  await browser.close()
}

console.log(failed ? `\n${failed} 项失败` : '\n全部通过')
process.exit(failed ? 1 : 0)
