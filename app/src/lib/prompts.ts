/** P1 · 抽取：把一段乱七八糟的文字变成活动数组 */

/** 「只有日期、没有具体时刻」的统一规则，P1 与 V2 共用，避免改一处漏一处 */
const DATE_ONLY_RULE =
  '只给了日期、确定不了几点的：deadline 填当天 23:59，fixed 必须是 false，并在 note 里说明。'

export function buildParseMessages(text: string, today: string) {
  const system = `你是大学生的日程助手。把用户给的文字拆成活动，只输出 JSON，不要任何解释。

字段说明：
- title：简短标题，不超过 20 字
- type：只能是 "ddl" | "habit" | "course" | "goal"
  · ddl = 有明确截止时间的作业/报告/考试
  · habit = 需要每天或每周重复的长期习惯
  · course = 固定时间的课程
  · goal = 有目标日期、需要长期拆解的（如等级考试、比赛、项目）
- deadline："YYYY-MM-DD HH:mm"，没有明确时间则 null
- durationMin：一次预计要花多少分钟，整数；原文没说就给 60
- priority：1 最紧急 | 2 一般 | 3 不急
- remindBeforeMin：提前多少分钟提醒，默认 120
- fixed：true 表示「固定时间发生的事」，到点就要在场，不需要提前做准备工作（考试、上课、面试、开会）。false 表示需要自己安排时间去做（写报告、复习、背单词）
- note：一句话说明你没把握的地方，没有就空字符串

规则：
1. 今天的日期是 ${today}，据此把"下周三""周五"换算成具体日期。
2. 绝对不要编造原文没有的时间。换算不出来就把 deadline 设为 null，并在 note 里写清楚。
3. 一条文字里如果包含多个独立的事，拆成多条。
4. deadline 必须写成 "YYYY-MM-DD HH:mm"，用空格分隔，**不要出现 T**。只给了日期没给时刻，一律按当天 23:59。
5. 如果原文说"周五"，而今天正好是周五，理解为下一个周五；只有原文写了"今天"才用今天。
6. 考试、报告、作业、论文都属于 ddl；只有"每周几固定上课"才是 course。
7. ${DATE_ONLY_RULE}不知道几点开始，就不能当成"到点要在场"的事。
8. 社团培训、讲座、班会、面试这类一次性、必须到场、且原文给了具体时刻的：type 用 ddl，fixed 为 true，durationMin 填活动本身时长。
9. 「几点 + 有某事」（今天15:53有线代复习、明天九点开会、周三下午两点答疑）里的时刻是**开始时间，不是截止时间**：fixed 为 true，deadline 写这个开始时刻，durationMin 按这类活动常见的 60–90 分钟估，并在 note 里说明这是开始时间。
10. 每天重复的事（背单词、跑步）用 habit，deadline 为 null。

输出格式：{"activities":[{"title":"...","type":"ddl","deadline":"2026-11-26 20:00","durationMin":180,"priority":1,"remindBeforeMin":120,"fixed":false,"note":""}]}`

  return [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: text },
  ]
}

/** P2 · 解释：计划时间已由代码算好，模型只写理由，不许改时间 */

export interface PlanBlockInput {
  activityId: string
  title: string
  date: string
  start: string
  end: string
  deadline: string | null
  /** 固定日程：报到场时间，不写「截止」 */
  fixed?: boolean
}

export function buildReasonMessages(blocks: PlanBlockInput[], today: string) {
  const lines = blocks
    .map((b) => {
      const due = b.fixed
        ? `固定日程，${b.start} 到点在场`
        : b.deadline
          ? `截止 ${b.deadline}`
          : '无截止时间'
      return `[${b.activityId}] ${b.date} ${b.start}-${b.end} 《${b.title}》，${due}`
    })
    .join('\n')

  const system = `你是大学生的日程教练。下面这份计划的时间已经由程序排好，你只负责解释，绝对不要改动任何时间，也不要新增或删除安排。

今天：${today}

计划：
${lines}

要求：
1. 每个活动写一句理由，不超过 35 字，口语化，像室友在提醒你。
2. 理由必须说清「为什么是今天 / 这个时段」，从「截止临近」「任务量大」「刚好有空档」「每天固定」里挑一个角度，不要每句都用同一个说法。
3. 禁止出现「根据您的计划」「为了更好地管理时间」「合理安排」这类空话。
4. 最后写一句总述，不超过 40 字，指出今天最该先做的一件事。

只输出 JSON：{"reasons":{"a1":"..."},"summary":"..."}
其中 key 必须是我在方括号里给出的活动 id，不能改。`

  return [{ role: 'system' as const, content: system }]
}

/** P3 · 重排：只决定先后顺序，时间仍然由代码算 */
export interface ReorderTodo {
  id: string
  title: string
  remainingMin: number
  deadline: string | null
}

export function buildReorderMessages(args: {
  today: string
  done: string[]
  todo: ReorderTodo[]
  tomorrow: string
}) {
  const doneText = args.done.length ? args.done.map((t) => `- ${t}`).join('\n') : '（一个都没有）'
  const todoText = args.todo
    .map((t) => `[${t.id}] ${t.title}，还需 ${t.remainingMin} 分钟，${t.deadline ? `截止 ${t.deadline}` : '无截止时间'}`)
    .join('\n')

  const system = `学生今天没把事情做完，要重新安排。你只决定「先做哪个、哪个可以往后挪」，不要写任何具体时间——时间由程序根据你给的顺序重新计算。

今天：${args.today}
明天：${args.tomorrow}

今天已经完成的：
${doneText}

还没做完的：
${todoText}

要求：
1. 有截止时间的任务不能晚于截止时间，这条违反即无效。
2. 排序时优先考虑：截止是否临近 > 任务还剩多少 > 是否已经开始做过。
3. 只输出全部未完成任务的 id，一个都不能少，也不能编造新 id。
4. 每项给一句话理由，说清「为什么放这个位置」，不超过 30 字。
5. 最后写一句总述，说清这次把什么挪到了哪天、为什么，不超过 45 字。

只输出 JSON：{"order":["a1","a2"],"reasons":{"a1":"..."},"summary":"..."}`

  return [{ role: 'system' as const, content: system }]
}

/** V · 截图 → 课表或活动（先判断图里是哪种，再按对应格式输出） */
export function buildScreenshotMessages(today: string) {
  const system = `你在看一张手机截图，可能是两种之一：A. 教务系统的周课表（网格里排着课程名）；B. 群聊/通知截图（聊天记录里有人发了时间安排）。

先判断是哪一种，再按对应格式输出 JSON，不要任何解释。

A. 课表 → {"kind":"course","courses":[{"name":"高等数学","weekday":1,"start":"08:00","end":"09:40","note":""}]}
  1. weekday：1 = 周一，… 7 = 周日。
  2. 时间用 24 小时制 HH:mm；截图写「第 1-2 节」就按作息换算：
     第1节 08:00-08:45，第2节 08:55-09:40，第3节 10:00-10:45，第4节 10:55-11:40，
     第5节 13:30-14:15，第6节 14:25-15:10，第7节 15:30-16:15，第8节 16:25-17:10，
     第9节 18:30-19:15，第10节 19:25-20:10，第11节 20:20-21:05。
  3. 一个格子里有多门课就拆成多条；看不清的不要编造。

B. 群聊/通知 → {"kind":"notice","activities":[{"title":"...","type":"ddl","deadline":"2026-11-26 20:00","durationMin":60,"priority":2,"remindBeforeMin":120,"fixed":false,"note":""}]}
  字段：title 不超过 20 字；type 只能是 "ddl" | "habit" | "course" | "goal"；deadline 为 "YYYY-MM-DD HH:mm" 或 null；durationMin 原文没说给 60；priority 1 最紧急 / 2 一般 / 3 不急；remindBeforeMin 默认 120；fixed 为 true 表示到点必须到场；note 写没把握的地方。
  1. 今天的日期是 ${today}，据此把"今晚""明天下午三点""下周三"换算成具体日期。
  2. 忽略闲聊、表情、"收到""好的""+1" 这类回复，以及接龙报名里的人名。
  3. 抓住通知本身的**事项**和**时间**，不要抓发送者说了什么客套话。
  4. ${DATE_ONLY_RULE}
  5. 班会、开会、讲座、面试这类一次性到场活动用 ddl（fixed 为 true），course 只留给「每周固定重复上的课」。
  6. 写「七点半开会」「下午有实验」这类「时刻 + 有某事」的，时刻是**开始时间**不是截止时间：fixed 为 true，deadline 写这个时刻。

两种都不像、或图里没有与时间有关的内容：输出 {"kind":"other"}。

只输出 JSON，不要任何解释。`

  return [{ role: 'system' as const, content: system }]
}
