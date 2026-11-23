/**
 * 排期视图：未来 N 天的日卡片 + 没排上的活动 + 「还没有安排」时的引导。
 * 时间全部来自 schedule.ts，这里只负责显示。
 */
import { MAX_DAILY_MIN, blockKey, type DayPlan } from '../lib/schedule'
import { isCheckedToday, streakDays } from '../lib/checkin'
import type { Activity } from '../types'

interface PlanBoardProps {
  dayPlans: DayPlan[]
  windowDays: number
  explainState: 'idle' | 'loading' | 'done' | 'error'
  summary: string
  replanSummary: string
  replanLoading: boolean
  onReplan: () => void
  onDemoReminder: () => void
  doneBlocks: Set<string>
  onToggleBlock: (key: string) => void
  aiReasons: Record<string, string>
  onCheckin: (id: string) => void
  todayStr: string
  unplanned: Activity[]
  courseCount: number
  coursesImported: boolean
}

export function PlanBoard({
  dayPlans,
  windowDays,
  explainState,
  summary,
  replanSummary,
  replanLoading,
  onReplan,
  onDemoReminder,
  doneBlocks,
  onToggleBlock,
  aiReasons,
  onCheckin,
  todayStr,
  unplanned,
  courseCount,
  coursesImported,
}: PlanBoardProps) {
  if (dayPlans.length === 0) {
    return (
      <section className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center sm:mt-6">
        <p className="text-sm text-slate-500">
          {courseCount
            ? `${coursesImported ? '' : '示例'}课表 ${courseCount} 门已就位，排期会自动避开上课时间。`
            : '还没有可排的活动。'}
        </p>
        <p className="mt-1 text-xs text-slate-400">粘一段群通知，或点上面的「填入示例」，这里就会出现未来几天的安排。</p>
      </section>
    )
  }

  /** 分段任务只在第一段写理由，后面的段落不要重复同一句 */
  const firstBlockKeys = new Set<string>()
  const seen = new Set<string>()
  for (const block of dayPlans.flatMap((day) => day.blocks)) {
    if (seen.has(block.activityId)) continue
    seen.add(block.activityId)
    firstBlockKeys.add(`${block.activityId}@${block.date}@${block.start}`)
  }

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:mt-6 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-slate-700">未来 {windowDays} 天 · 自动排期</h2>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="text-[11px] text-slate-400">
            {explainState === 'loading'
              ? 'AI 正在写理由…'
              : explainState === 'error'
                ? '理由生成失败，先用规则文案'
                : `先保截止，再塞空档 · 单日上限 ${MAX_DAILY_MIN / 60} 小时 · 已避开课程与饭点`}
          </span>
          <button
            type="button"
            onClick={onDemoReminder}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
          >
            🔔 60 秒后演示提醒
          </button>
          <button
            type="button"
            onClick={onReplan}
            disabled={replanLoading}
            className="rounded-lg border border-slate-300 px-2.5 py-1 text-[11px] text-slate-700 transition hover:border-slate-500 disabled:opacity-50"
          >
            ↻ {replanLoading ? '重排中…' : '今天没做完，重排'}
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
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
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
                      onClick={() => onToggleBlock(blockKey(block))}
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
                      onClick={() => onCheckin(block.activityId)}
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

      {unplanned.length > 0 && (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-500">
          还有 {unplanned.length} 项没排进这 {windowDays} 天：
          {unplanned.map((item) => item.title).join('、')}
          {unplanned.some((item) => item.deadline) ? '——要么截止更远，要么这几天实在塞不下。' : '——这几天塞不下了。'}
        </p>
      )}
    </section>
  )
}
