import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { chat, extractJson } from './lib/api'
import { buildParseMessages } from './lib/prompts'
import { explainPlan, reorderPlan } from './lib/plan'
import { blockKey, groupByDay, dayKey, planTasks, toMin, tomorrow } from './lib/schedule'
import { humanizeRemaining, normalizeDeadline } from './lib/time'
import { isCheckedToday, streakDays, toggleCheckin } from './lib/checkin'
import { ensureNotificationPermission, findDue, reminderKey, systemNotify } from './lib/reminder'
import { loadItems, saveItems } from './lib/store'
import { SAMPLE_COURSES } from './data/courses'
import { TYPE_META, type Activity, type ActivityType } from './types'

const SAMPLE = `下周三（11月26日）晚上8点前交《机器学习》实验报告，大概要写3小时。
周五下午2点英语四级模拟考。
每天背50个单词。
12月12日上午9点四级正式考试。
每周二、四晚上7-9点上高数辅导课。`

interface RawActivity {
  title?: string
  type?: string
  deadline?: string | null
  durationMin?: number
  priority?: number
  remindBeforeMin?: number
  fixed?: boolean
  note?: string
}

interface ToastItem {
  id: string
  title: string
  body: string
}

const TYPES: ActivityType[] = ['ddl', 'habit', 'course', 'goal']

const pad = (n: number) => String(n).padStart(2, '0')

function nowParts() {
  const d = new Date()
  const week = '日一二三四五六'[d.getDay()]
  const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return { iso, label: `${iso}（星期${week}）` }
}

function normalize(raw: RawActivity[]): Activity[] {
  return raw
    .filter((item) => typeof item.title === 'string' && item.title.trim().length > 0)
    .map((item) => {
      const type = TYPES.includes(item.type as ActivityType) ? (item.type as ActivityType) : 'ddl'
      const priority = Math.min(3, Math.max(1, Math.round(Number(item.priority) || 2))) as 1 | 2 | 3
      return {
        id: crypto.randomUUID(),
        title: String(item.title).trim(),
        type,
        deadline: normalizeDeadline(item.deadline),
        durationMin: Math.max(5, Math.round(Number(item.durationMin) || 60)),
        priority,
        remindBeforeMin: Math.max(0, Math.round(Number(item.remindBeforeMin) || 120)),
        fixed: item.fixed === true,
        note: item.note || '',
        source: 'ai' as const,
        status: 'todo' as const,
      }
    })
}

function App() {
  const [text, setText] = useState(SAMPLE)
  const [items, setItems] = useState<Activity[]>(() => loadItems())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [meta, setMeta] = useState('')
  const [rawJson, setRawJson] = useState('')

  const [aiReasons, setAiReasons] = useState<Record<string, string>>({})
  const [summary, setSummary] = useState('')
  const [explainState, setExplainState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const requestId = useRef(0)

  const [doneBlocks, setDoneBlocks] = useState<Set<string>>(() => new Set())
  const [replanOrder, setReplanOrder] = useState<string[] | null>(null)
  const [replanRemaining, setReplanRemaining] = useState<Record<string, number> | null>(null)
  const [planStart, setPlanStart] = useState<Date | null>(null)
  const [replanState, setReplanState] = useState<'idle' | 'loading'>('idle')
  const [replanSummary, setReplanSummary] = useState('')

  const blocks = useMemo(
    () =>
      items.length
        ? planTasks(items, SAMPLE_COURSES, {
            from: planStart ?? undefined,
            order: replanOrder ?? undefined,
            remainingMin: replanRemaining ?? undefined,
          })
        : [],
    [items, planStart, replanOrder, replanRemaining],
  )
  const dayPlans = useMemo(() => groupByDay(blocks, items), [blocks, items])

  /** 每块计划里，第一次出现的那个活动的区块（分段任务只在第一段写理由） */
  const firstBlockKeys = useMemo(() => {
    const seen = new Set<string>()
    const keys = new Set<string>()
    for (const block of blocks) {
      if (seen.has(block.activityId)) continue
      seen.add(block.activityId)
      keys.add(`${block.activityId}@${block.date}@${block.start}`)
    }
    return keys
  }, [blocks])

  useEffect(() => {
    if (!blocks.length) {
      setAiReasons({})
      setSummary('')
      setExplainState('idle')
      return
    }

    const id = requestId.current + 1
    requestId.current = id
    setExplainState('loading')

    const seen = new Set<string>()
    const payload = blocks
      .filter((block) => {
        if (seen.has(block.activityId)) return false
        seen.add(block.activityId)
        return true
      })
      .map((block) => {
        const activity = items.find((a) => a.id === block.activityId)
        return {
          activityId: block.activityId,
          title: activity?.title ?? '',
          date: block.date,
          start: block.start,
          end: block.end,
          deadline: activity?.deadline ?? null,
        }
      })

    const { iso, label } = nowParts()
    explainPlan(payload, `${iso}（${label}）`)
      .then((result) => {
        if (requestId.current !== id) return
        setAiReasons(result.reasons)
        setSummary(result.summary)
        setExplainState('done')
      })
      .catch(() => {
        if (requestId.current !== id) return
        setExplainState('error')
      })
  }, [blocks, items])

  const [toasts, setToasts] = useState<ToastItem[]>([])
  const firedRef = useRef<Set<string>>(new Set())
  const todayStr = dayKey(new Date())

  const addToast = useCallback((title: string, body: string) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, title, body }])
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 8000)
  }, [])

  // 数据落到 localStorage，刷新不丢
  useEffect(() => {
    saveItems(items)
  }, [items])

  // 每 15 秒扫一次「该提醒的事」
  useEffect(() => {
    const tick = () => {
      for (const activity of findDue(items, new Date(), firedRef.current)) {
        firedRef.current.add(reminderKey(activity))
        const title = `还有 ${activity.remindBeforeMin} 分钟：${activity.title}`
        const body = activity.deadline ? `截止 ${activity.deadline}` : ''
        systemNotify(title, body)
        addToast(title, body)
      }
    }
    tick()
    const timer = window.setInterval(tick, 15_000)
    return () => window.clearInterval(timer)
  }, [items, addToast])

  const handleCheckin = (id: string) => {
    setItems((prev) => prev.map((a) => (a.id === id ? toggleCheckin(a) : a)))
  }

  const handleDemoReminder = async () => {
    const permission = await ensureNotificationPermission()
    addToast(
      '已安排：60 秒后提醒',
      permission === 'granted' ? '浏览器通知和页面右下角都会有' : '浏览器通知未授权，只会出现在页面右下角',
    )
    window.setTimeout(() => {
      const title = `该准备下一件事了：${items[0]?.title ?? '下一项任务'}`
      systemNotify(title, '这是演示提醒，正式使用时会按每个任务的提前量自动触发')
      addToast(title, '这是演示提醒')
    }, 60_000)
  }

  const toggleBlockDone = (key: string) => {
    setDoneBlocks((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  /** 今天没做完 → 只让模型排先后顺序，时间由引擎从明天起重算 */
  const handleReplan = async () => {
    if (!blocks.length || replanState === 'loading') return

    const todayK = dayKey(new Date())
    const todays = blocks.filter((b) => b.date === todayK)
    if (!todays.length) {
      addToast('今天没有安排', '不需要重排')
      return
    }

    const completedMin = new Map<string, number>()
    for (const block of blocks) {
      if (!doneBlocks.has(blockKey(block))) continue
      const minutes = toMin(block.end) - toMin(block.start)
      completedMin.set(block.activityId, (completedMin.get(block.activityId) ?? 0) + minutes)
    }

    const flexible = items.filter((a) => a.type !== 'course' && a.type !== 'habit' && a.status !== 'done')
    const todo: Array<{ id: string; title: string; remainingMin: number; deadline: string | null }> = []
    const remainingMin: Record<string, number> = {}
    const doneTitles: string[] = []

    for (const activity of flexible) {
      const done = completedMin.get(activity.id) ?? 0
      const left = Math.max(0, activity.durationMin - done)
      if (left < 30) {
        doneTitles.push(activity.title)
        continue
      }
      remainingMin[activity.id] = left
      todo.push({ id: activity.id, title: activity.title, remainingMin: left, deadline: activity.deadline })
    }

    if (!todo.length) {
      addToast('今天的活都做完了', '没有需要重排的任务')
      return
    }

    setReplanState('loading')
    try {
      const { iso, label } = nowParts()
      const result = await reorderPlan({
        today: `${iso}（${label}）`,
        done: doneTitles,
        todo,
        tomorrow: dayKey(tomorrow()),
      })
      setReplanOrder(result.order)
      setReplanRemaining(remainingMin)
      setPlanStart(tomorrow())
      setDoneBlocks(new Set())
      setReplanSummary(result.summary)
      addToast('已经重排', result.summary || '未完成的项目已挪到明天之后')
    } catch (err) {
      addToast('重排失败，计划没动', err instanceof Error ? err.message : String(err))
    } finally {
      setReplanState('idle')
    }
  }

  async function handleParse() {
    if (!text.trim() || loading) return
    setLoading(true)
    setError('')
    setRawJson('')
    try {
      const { iso, label } = nowParts()
      const result = await chat(buildParseMessages(text, `${iso}（${label}）`), { json: true })
      setRawJson(result.content)
      const parsed = extractJson<{ activities?: RawActivity[] }>(result.content)
      const list = normalize(parsed.activities ?? [])
      if (!list.length) throw new Error('模型没有拆出任何活动，换一段文字试试')
      setItems(list)
      setDoneBlocks(new Set())
      setPlanStart(null)
      setReplanOrder(null)
      setReplanRemaining(null)
      setReplanSummary('')
      setMeta(`${result.model} · ${result.ms}ms · ${result.usage?.total_tokens ?? '?'} tokens`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-1 text-xs font-medium tracking-widest text-slate-400">HDU · AIGC 应用创新大赛 · 赛题一</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">今天做什么</h1>
            <p className="mt-1 text-sm text-slate-500">把乱糟糟的通知粘进来，AI 帮你拆成能执行的活动。</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500">
            <span className={`h-1.5 w-1.5 rounded-full ${meta ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            {meta || '等待第一次解析'}
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <label htmlFor="raw" className="text-sm font-medium text-slate-700">
                原始文字
              </label>
              <button
                type="button"
                onClick={() => setText(SAMPLE)}
                className="text-xs text-slate-400 transition hover:text-slate-700"
              >
                填入示例
              </button>
            </div>
            <textarea
              id="raw"
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
              className="h-60 w-full resize-none rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm leading-7 text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white"
              placeholder="粘贴群通知、作业要求、考试安排……"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400">{text.length} 字</span>
              <button
                type="button"
                onClick={handleParse}
                disabled={loading || !text.trim()}
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loading ? '解析中…' : 'AI 解析 →'}
              </button>
            </div>
            {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-slate-700">解析结果</h2>
              <span className="text-xs text-slate-400">{items.length ? `${items.length} 项` : '—'}</span>
            </div>

            {items.length === 0 ? (
              <div className="flex h-60 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
                还没有结果，点左边「AI 解析」
              </div>
            ) : (
              <ul className="space-y-2.5">
                {items.map((item) => {
                  const metaInfo = TYPE_META[item.type]
                  return (
                    <li
                      key={item.id}
                      className={`rounded-xl border border-slate-200 border-l-4 ${metaInfo.accent} bg-white px-3.5 py-3`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-slate-900">{item.title}</p>
                        <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${metaInfo.chip}`}>
                          {metaInfo.label}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                        <span>{item.deadline ? `截止 ${item.deadline} · ${humanizeRemaining(item.deadline)}` : '无明确截止'}</span>
                        <span>预计 {item.durationMin} 分钟</span>
                        <span>优先级 {item.priority}</span>
                      </div>
                      {item.note ? <p className="mt-1 text-[11px] text-amber-600">⚠ {item.note}</p> : null}
                    </li>
                  )
                })}
              </ul>
            )}

            {rawJson && (
              <details className="mt-4 text-xs text-slate-400">
                <summary className="cursor-pointer select-none hover:text-slate-600">查看模型原始输出</summary>
                <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-5 text-slate-200">
                  {rawJson}
                </pre>
              </details>
            )}
          </section>
        </div>

        {dayPlans.length > 0 && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-slate-700">未来 3 天 · 自动排期</h2>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-400">
                  {explainState === 'loading'
                    ? 'AI 正在写理由…'
                    : explainState === 'error'
                      ? '理由生成失败，先用规则文案'
                      : '先保截止，再塞空档 · 单日上限 4 小时 · 已避开课程与饭点'}
                </span>
                <button
                  type="button"
                  onClick={handleDemoReminder}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
                >
                  🔔 60 秒后演示提醒
                </button>
                <button
                  type="button"
                  onClick={handleReplan}
                  disabled={replanState === 'loading'}
                  className="rounded-lg border border-slate-300 px-2.5 py-1 text-[11px] text-slate-700 transition hover:border-slate-500 disabled:opacity-50"
                >
                  ↻ {replanState === 'loading' ? '重排中…' : '今天没做完，重排'}
                </button>
              </div>
            </div>
            {summary && (
              <p className="mb-3 rounded-lg bg-amber-50/70 px-3 py-2 text-xs leading-5 text-amber-900">
                <span className="mr-1.5 font-medium text-amber-700">今日一句</span>
                {summary}
              </p>
            )}
            {replanSummary && (
              <p className="mb-3 rounded-lg bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900">
                <span className="mr-1.5 font-medium text-sky-700">已重排</span>
                {replanSummary}
              </p>
            )}
            <div className="grid gap-4 md:grid-cols-3">
              {dayPlans.map((day) => (
                <div key={day.date} className="rounded-xl bg-slate-50/80 p-3">
                  <p className="mb-2 flex items-baseline gap-2 text-xs font-medium text-slate-600">
                    {day.date.slice(5)}
                    <span className="text-[11px] font-normal text-slate-400">{day.weekday}</span>
                  </p>
                  <ul className="space-y-1.5">
                    {day.blocks.map((block, i) => (
                      <li key={`${block.activityId}-${i}`} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => toggleBlockDone(blockKey(block))}
                            aria-label="标记完成"
                            className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border text-[9px] leading-none transition ${
                              doneBlocks.has(blockKey(block))
                                ? 'border-emerald-500 bg-emerald-500 text-white'
                                : 'border-slate-300 text-transparent hover:border-slate-500'
                            }`}
                          >
                            ✓
                          </button>
                          <span className="text-[11px] tabular-nums text-slate-400">
                            {block.start}–{block.end}
                          </span>
                          <span
                            className={`flex-1 truncate text-right text-[12px] ${
                              doneBlocks.has(blockKey(block)) ? 'text-slate-400 line-through' : 'text-slate-800'
                            }`}
                          >
                            {block.activity?.title}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] leading-4 text-slate-500">
                          {firstBlockKeys.has(`${block.activityId}@${block.date}@${block.start}`)
                            ? aiReasons[block.activityId] ?? block.reason
                            : block.reason}
                        </p>
                        {block.activity?.type === 'habit' && block.date === todayStr && (
                          <button
                            type="button"
                            onClick={() => handleCheckin(block.activityId)}
                            className={`mt-1.5 rounded-md px-2 py-0.5 text-[10px] transition ${
                              isCheckedToday(block.activity)
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'border border-slate-200 text-slate-500 hover:border-emerald-400 hover:text-emerald-700'
                            }`}
                          >
                            {isCheckedToday(block.activity)
                              ? `✓ 已打卡 · 连续 ${streakDays(block.activity.checkins)} 天`
                              : '打卡'}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="mt-8 text-xs text-slate-400">
          原型 v0.3 · 录入解析 / 规则排期 / AI 理由 / 打卡 / 到点提醒已通（一键重排在 Day 4 接入）
        </footer>
      </div>

      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-72 flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-lg shadow-slate-900/5"
          >
            <p className="text-xs font-medium text-slate-800">{toast.title}</p>
            {toast.body ? <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{toast.body}</p> : null}
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
