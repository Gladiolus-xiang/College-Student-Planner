/** 解析结果：每条带类型色条、可单条删除，顶部可一键清空 */
import { TYPE_META, type Activity } from '../types'
import { humanizeRemaining } from '../lib/time'

interface ParseListProps {
  items: Activity[]
  onRemove: (id: string) => void
  onClear: () => void
  rawJson: string
}

/** 截止那一行的文案：固定日程说「开始」，习惯说「每天几点」，其余说「截止 + 还剩多久」 */
function deadlineText(item: Activity): string {
  if (!item.deadline) return item.preferStart ? `每天 ${item.preferStart} 开始` : '无明确截止'
  if (item.fixed) return `${item.deadline.slice(11)} 开始 · 固定日程`
  return `截止 ${item.deadline} · ${humanizeRemaining(item.deadline)}`
}

export function ParseList({ items, onRemove, onClear, rawJson }: ParseListProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-700">解析结果</h2>
        <div className="flex items-center gap-3">
          {items.length > 0 && (
            <button type="button" onClick={onClear} className="text-[11px] text-slate-400 transition hover:text-rose-600">
              清空
            </button>
          )}
          <span className="text-xs text-slate-400">{items.length ? `${items.length} 项` : '—'}</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex h-60 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
          还没有结果，点上面的「AI 解析」
        </div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => {
            const meta = TYPE_META[item.type]
            return (
              <li key={item.id} className={`rounded-xl border border-slate-200 border-l-4 ${meta.accent} bg-white px-3.5 py-3`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-slate-900">{item.title}</p>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${meta.chip}`}>{meta.label}</span>
                    <button
                      type="button"
                      onClick={() => onRemove(item.id)}
                      aria-label={`删除 ${item.title}`}
                      className="px-1 text-xs leading-none text-slate-300 transition hover:text-rose-600"
                    >
                      ×
                    </button>
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                  <span>{deadlineText(item)}</span>
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
  )
}
