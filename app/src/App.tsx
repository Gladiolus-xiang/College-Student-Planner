import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { chat, extractJson } from './lib/api'
import { buildParseMessages, buildScreenshotMessages } from './lib/prompts'
import { explainPlan, reorderPlan } from './lib/plan'
import { dayKey, groupByDay, planTasks, planWindowDays, toMin, tomorrow } from './lib/schedule'
import { toggleCheckin } from './lib/checkin'
import { dedupeActivities, dedupeCourses } from './lib/dedupe'
import { ensureNotificationPermission, findDue, reminderKey, systemNotify } from './lib/reminder'
import { loadCourses, loadItems, saveCourses, saveItems } from './lib/store'
import { VISION_MODEL, fileToDataUrl, isImageFile } from './lib/vision'
import { normalizeActivities, normalizeCourses, type RawActivity, type RawCourse } from './lib/normalize'
import { SAMPLE_COURSES } from './data/courses'
import { Composer } from './components/Composer'
import { CourseBoard } from './components/CourseBoard'
import { ParseList } from './components/ParseList'
import { PlanBoard } from './components/PlanBoard'
import type { Activity, CourseSlot } from './types'

const SAMPLE = `下周三（11月26日）晚上8点前交《机器学习》实验报告，大概要写3小时。
周五下午2点英语四级模拟考。
每天背50个单词。
12月12日上午9点四级正式考试。
每周二、四晚上7-9点上高数辅导课。`

interface ToastItem {
  id: string
  title: string
  body: string
}

const pad = (n: number) => String(n).padStart(2, '0')

function nowParts() {
  const d = new Date()
  const week = '日一二三四五六'[d.getDay()]
  const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return { iso, label: `${iso}（星期${week}）` }
}

function App() {
  const [text, setText] = useState('')
  const [items, setItems] = useState<Activity[]>(() => dedupeActivities(loadItems()).fresh)
  const [courses, setCourses] = useState<CourseSlot[]>(() => loadCourses() ?? SAMPLE_COURSES)
  /** 课表是系统示例还是自己导入的 —— 文案要能说清，别让人以为页面自己冒出 9 门课 */
  const [coursesImported, setCoursesImported] = useState<boolean>(() => loadCourses() !== null)
  const [imageBusy, setImageBusy] = useState(false)
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

  /** 计划窗口：至少 3 天，覆盖最远的截止，最多 7 天 */
  const windowDays = useMemo(() => planWindowDays(items), [items])

  const blocks = useMemo(
    () =>
      items.length
        ? planTasks(items, courses, {
            days: windowDays,
            from: planStart ?? undefined,
            order: replanOrder ?? undefined,
            remainingMin: replanRemaining ?? undefined,
          })
        : [],
    [items, courses, planStart, replanOrder, replanRemaining, windowDays],
  )
  const dayPlans = useMemo(() => groupByDay(blocks, items), [blocks, items])

  /** 有活动没能排进这个窗口（时间不够，或截止更远），要如实告诉用户，不能让它悄悄消失 */
  const unplanned = useMemo(
    () =>
      items.filter(
        (item) => item.type !== 'habit' && item.status !== 'done' && !blocks.some((b) => b.activityId === item.id),
      ),
    [items, blocks],
  )

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
          fixed: activity?.fixed === true,
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

  /** 单条删除：解析结果里总有需要扔掉的一条 */
  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((a) => a.id !== id))
    setReplanOrder((prev) => (prev ? prev.filter((x) => x !== id) : prev))
  }

  const clearAll = () => {
    setItems([])
    setDoneBlocks(new Set())
    setPlanStart(null)
    setReplanOrder(null)
    setReplanRemaining(null)
    setReplanSummary('')
    setSummary('')
    setRawJson('')
    setError('')
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
      if (!doneBlocks.has(`${block.activityId}@${block.date}@${block.start}`)) continue
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

  /** 截图识别：模型先判断图里是课表还是群通知，再按对应格式解析 —— 用户只需要「贴截图」一个动作 */
  const handleImage = async (file: File) => {
    if (!isImageFile(file)) {
      setError('只支持图片文件（png / jpg / webp）')
      return
    }
    if (imageBusy) return

    setImageBusy(true)
    setError('')
    try {
      const dataUrl = await fileToDataUrl(file)
      const { iso, label } = nowParts()
      const today = `${iso}（${label}）`
      const messages = [
        buildScreenshotMessages(today)[0],
        {
          role: 'user' as const,
          content: [
            { type: 'text' as const, text: '这张截图是课表还是群通知？按对应格式解析。' },
            { type: 'image_url' as const, image_url: { url: dataUrl, detail: 'high' as const } },
          ],
        },
      ]

      const result = await chat(messages, { json: true, model: VISION_MODEL })
      setRawJson(result.content)
      setMeta(`${result.model} · ${result.ms}ms · ${result.usage?.total_tokens ?? '?'} tokens`)

      const parsed = extractJson<{ kind?: string; courses?: RawCourse[]; activities?: RawActivity[] }>(result.content)
      const looksLikeCourse = parsed.kind === 'course' || (!parsed.activities?.length && Boolean(parsed.courses?.length))

      if (looksLikeCourse) {
        const list = normalizeCourses(parsed.courses ?? [])
        const { fresh: courseList, skipped } = dedupeCourses(list)
        if (!courseList.length) throw new Error('没有识别出课程，换一张更清晰的课表截图试试')
        setCourses(courseList)
        saveCourses(courseList)
        setCoursesImported(true)
        addToast(`识别到 ${courseList.length} 门课`, skipped ? `另有 ${skipped} 条重复已跳过` : '排期会自动避开这些时段')
        return
      }

      const list = normalizeActivities(parsed.activities ?? [])
      if (!list.length) throw new Error('这张截图既不像课表，也没有找到与时间有关的内容')
      const { fresh, skipped } = dedupeActivities(list, items)
      if (!fresh.length) {
        addToast('没有新内容', `这 ${list.length} 件事已经在计划里了`)
        return
      }
      setItems((prev) => [...prev, ...fresh])
      addToast(`从截图里读出 ${fresh.length} 件事`, skipped ? `另有 ${skipped} 条重复已跳过` : '已经加入下方的计划')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setImageBusy(false)
    }
  }

  const pickImage = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (file) void handleImage(file)
    }
    input.click()
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
      const list = normalizeActivities(parsed.activities ?? [])
      const { fresh, skipped } = dedupeActivities(list, items)
      if (!list.length) throw new Error('模型没有拆出任何活动，换一段文字试试')
      setMeta(`${result.model} · ${result.ms}ms · ${result.usage?.total_tokens ?? '?'} tokens`)
      if (!fresh.length) {
        addToast('没有新内容', `这 ${list.length} 件事已经在计划里了`)
        return
      }
      // 追加而不是整批替换：之前识别出的课表/通知不会因为再解析一段文字就消失
      setItems((prev) => [...prev, ...fresh])
      addToast(`解析出 ${fresh.length} 项`, skipped ? `另有 ${skipped} 条重复已跳过` : '已加入下方计划')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8">
          <div>
            <p className="mb-1 text-xs font-medium tracking-widest text-slate-400">HDU · AIGC 应用创新大赛 · 赛题一</p>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">今天做什么</h1>
            <p className="mt-1 text-sm text-slate-500">把乱糟糟的通知粘进来，AI 帮你拆成能执行的活动。</p>
          </div>
          <div className="flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            <span className="truncate">{meta || '等待第一次解析'}</span>
          </div>
        </header>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1.05fr_1fr]">
          <Composer
            text={text}
            onTextChange={setText}
            sample={SAMPLE}
            onParse={handleParse}
            loading={loading}
            imageBusy={imageBusy}
            onPickImage={pickImage}
            onImageFile={(file) => void handleImage(file)}
            error={error}
            courseCount={courses.length}
          />
          <ParseList items={items} onRemove={removeItem} onClear={clearAll} rawJson={rawJson} />
        </div>

        <CourseBoard courses={courses} imported={coursesImported} />

        <PlanBoard
          dayPlans={dayPlans}
          windowDays={windowDays}
          explainState={explainState}
          summary={summary}
          replanSummary={replanSummary}
          replanLoading={replanState === 'loading'}
          onReplan={handleReplan}
          onDemoReminder={handleDemoReminder}
          doneBlocks={doneBlocks}
          onToggleBlock={toggleBlockDone}
          aiReasons={aiReasons}
          onCheckin={handleCheckin}
          todayStr={todayStr}
          unplanned={unplanned}
          courseCount={courses.length}
          coursesImported={coursesImported}
        />

        <footer className="mt-8 text-xs text-slate-400">原型 v0.3</footer>
      </div>

      <div className="pointer-events-none fixed inset-x-3 bottom-4 z-50 flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:w-72">
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
