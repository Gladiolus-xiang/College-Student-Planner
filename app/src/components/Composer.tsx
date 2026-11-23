/** 输入区：原始文字 + 截图入口。页面上唯一一个「贴截图」按钮，粘贴/拖图也走同一个回调 */
interface ComposerProps {
  text: string
  onTextChange: (value: string) => void
  sample: string
  onParse: () => void
  loading: boolean
  imageBusy: boolean
  onPickImage: () => void
  onImageFile: (file: File) => void
  error: string
  courseCount: number
}

export function Composer({
  text,
  onTextChange,
  sample,
  onParse,
  loading,
  imageBusy,
  onPickImage,
  onImageFile,
  error,
  courseCount,
}: ComposerProps) {
  const takeImage = (files: FileList | null) => {
    const file = Array.from(files ?? []).find((f) => f.type.startsWith('image/'))
    if (file) onImageFile(file)
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <label htmlFor="raw" className="text-sm font-medium text-slate-700">
          原始文字
        </label>
        <button
          type="button"
          onClick={() => onTextChange(sample)}
          className="text-xs text-slate-400 transition hover:text-slate-700"
        >
          填入示例
        </button>
      </div>
      <textarea
        id="raw"
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        onPaste={(e) => {
          const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith('image/'))
          if (file) {
            e.preventDefault()
            onImageFile(file)
          }
        }}
        onDrop={(e) => {
          e.preventDefault()
          takeImage(e.dataTransfer.files)
        }}
        onDragOver={(e) => e.preventDefault()}
        spellCheck={false}
        className="h-44 w-full resize-none rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-base leading-7 text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white sm:h-60 sm:text-sm"
        placeholder="粘贴群通知、作业要求、考试安排……电脑上可以直接 Ctrl+V 贴截图"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-400">{text.length} 字</span>
        <button
          type="button"
          onClick={onParse}
          disabled={loading || !text.trim()}
          className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:py-2.5"
        >
          {loading ? '解析中…' : 'AI 解析 →'}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={onPickImage}
          disabled={imageBusy}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 transition hover:border-slate-400 hover:text-slate-900 disabled:opacity-50 sm:px-2.5 sm:py-1 sm:text-[11px]"
        >
          {imageBusy ? '识别中…' : '📷 贴截图识别'}
        </button>
        <span className="text-[11px] text-slate-400">课表、群通知都行；电脑上也能直接 Ctrl+V</span>
        <span className="ml-auto text-[11px] text-slate-300">当前课表 {courseCount} 门</span>
      </div>
      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
    </section>
  )
}
