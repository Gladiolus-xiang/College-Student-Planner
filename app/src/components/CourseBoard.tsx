/** 本周课表：导入后就该看见这些课，而不是只有一个数字；每条都能删（识别错的那条） */
import type { CourseSlot } from '../types'

interface CourseBoardProps {
  courses: CourseSlot[]
  imported: boolean
  onRemove: (id: string) => void
}

export function CourseBoard({ courses, imported, onRemove }: CourseBoardProps) {
  if (!courses.length) return null

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:mt-6 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-slate-700">本周课表</h2>
        <span className="text-[11px] text-slate-400">
          {courses.length} 门 · {imported ? '识别错的那条点 × 删掉，排期立刻不再避它' : '示例课表，贴一张课表截图换成你的'}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {([1, 2, 3, 4, 5, 6, 7] as const).map((weekday) => {
          const list = courses.filter((c) => c.weekday === weekday).sort((a, b) => a.start.localeCompare(b.start))
          if (!list.length) return null
          return (
            <div key={weekday} className="rounded-xl bg-slate-50/80 px-3 py-2.5">
              <p className="mb-1.5 text-[11px] font-medium text-slate-500">周{'一二三四五六日'[weekday - 1]}</p>
              <ul className="space-y-1">
                {list.map((course) => (
                  <li key={course.id} className="flex items-baseline gap-2 text-[11px]">
                    <span className="shrink-0 tabular-nums text-slate-400">{course.start}</span>
                    <span className="flex-1 truncate text-slate-700">{course.name}</span>
                    <button
                      type="button"
                      onClick={() => onRemove(course.id)}
                      aria-label={`删除 ${course.name}`}
                      className="shrink-0 px-1 text-xs leading-none text-slate-300 transition hover:text-rose-600"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}
