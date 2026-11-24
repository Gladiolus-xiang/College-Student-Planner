# AGENTS.md

大学生日程编排原型（杭电 AIGC 大赛 · 赛题一）。粘贴一段文字或一张截图 → 结构化活动 → 规则引擎排进课表空档 → 提醒 / 打卡 / 重排。

# 修改要求
  1.改完用Git存档
  2.修改后更新deliverables中的内容
  3.写新函数、新规则前，先搜项目里有没有现成的——同一个规则写两遍迟早对不上

## 跑起来

```powershell
cd app
npm.cmd run dev      # 必须 npm.cmd，Windows 禁 npm.ps1
```

`.env` 放 `DEEPSEEK_API_KEY`；代理每次请求重读，改完不用重启。

## 这个项目特有的坑

1. **时间由代码算，理由由模型写。** 绝不让模型输出具体时段——它会排出凌晨三点、占用上课时间。模型只给结构化字段、先后顺序和理由。
2. **模型输出必须过校验层**：缺 id 补回、时间格式归一、失败回退规则文案。任何「把模型 JSON 直接落库」的改动都是事故。
3. **文档真源是 `deliverables/项目文档-初稿.docx`**。整体重建会覆盖团队手改的内容；改文档要写一次性脚本按文本定位，改完删脚本。旧的生成器 `scripts/build_doc.py` 已删除，需要时从 git 历史里取，别重新加回仓库。
4. **替换文档内配图要按「出现顺序」定位**，不能按图片部件 id，否则闭环图和架构图会对调。
5. 截图识别用 `deepseek-flash`，纯文字用 `deepseek-chat`，同一个 key，别混用。
6. 新增规则前先搜：时间解析统一走 `src/lib/time.ts` 的 `parseDeadline`；「只有日期 → 23:59 → fixed=false」只在 `prompts.ts` 的 `DATE_ONLY_RULE` 写一次。
7. **`/api/chat` 只有一份实现**：`app/edge-functions/api/chat.js`。`app/server/deepseek.ts` 只是把 Node 的 req/res 翻译成 Request/Response 的本地壳，不要在里面另写一份逻辑。线上跑边缘函数，本地跑同一个 `handleChat`。
8. **线上请求体上限 1 MB**（边缘函数的硬限制）。截图在前端压到 1280px / JPEG 0.82，超了自动降档；不要把 `MAX_BODY_CHARS` 调大，那只会把 413 从函数里挪到平台层。
9. 每日额度靠 KV，绑定变量名必须是 `QUOTA`；没绑定时代码自动跳过限流、不报错——所以「额度没生效」先查绑定，不是查代码。
10. 去重口径只有一处：`src/lib/dedupe.ts`（标题归一 + 截止时间 + 习惯钟点）。别在 `App.tsx` 里另写一遍相等比较——两处口径迟早对不上。
11. 固定日程的 `deadline` 存的是**开始时刻**（`fixedInterval` 拿它当到场时间）。提示词里凡是「几点 + 有某事」都要判成 fixed，界面文案说「开始」不写「截止」。
12. **习惯（habit）没有截止时间**：`deadline` 恒为 null，原文说的钟点存 `preferStart`（"20:00"）。排期按 `preferStart` 开始，没说才默认 19:00；钟点被占就顺延并在理由里写明，别默认 19:00 开始、20:00 结束——那看着像「8 点截止」。
13. 录入是「追加」不是「替换」：解析/截图结果先去重再 append，绝不能 `setItems(新数组)` 把已有活动冲掉。截图入口只有一个（`pickImage()`），视觉提示词只有 `buildScreenshotMessages`，不要再按课表/通知拆两条。
14. **排期必须尊重截止**：有 deadline 的任务，每一块都要在截止前结束（`schedule.ts` 的 `deadlineCapMin`）。排不进去就不排，交给「没排上」列表说明原因——绝不能排出「20:15 才动工，20:06 截止」这种块。
15. **别用 PowerShell 的 `Set-Content` / `-replace` 改源码**：会把中文写成乱码（已经毁过一次 `schedule.ts`）。改文件只用编辑工具，或者用 Python 显式 `encoding='utf-8'`。
16. **边缘运行时能力有限**：线上实测没有 `AbortSignal.timeout`（报 `is not a function`，表现为 502「调用模型失败」）。超时一律 `AbortController` + `setTimeout` + `clearTimeout`；新增任何 Web API 前先想「EdgeOne 的运行时有没有」。
17. **课表识别的星期看「文字落在哪一列」**，不是色块边框——色块跨列时模型会把课复制到相邻两天（真实截图踩过：周五的高数被记成周六）。提示词 A 节第 4 条已写明；识别错的课在「本周课表」里点 × 删掉即可，`removeCourse` 会写回 localStorage。
18. **别直接用只在安全上下文里有的 API**：`crypto.randomUUID()` 在 http:// 打开时是 undefined（部署后用 http 访问就崩，报 `crypto.randomUUID is not a function`）。前端要 id 一律走 `src/lib/id.ts` 的 `uid()`；`Notification` 之类同理，用前先判断。
19. **线上「模型超时」先怀疑平台的默认值**：EdgeOne 边缘函数的 `fetch` 默认「建连 3s / 读响应 15s / 发请求 300s」，模型吐 1000+ token 必然超（表现为「调用模型失败: net_exception_timeout」，本地同样代码 1.6–3.3s 就回）。调模型时必须带 `eo: { timeoutSetting }`（`chat.js` 的 `EDGE_TIMEOUT`），自己的 `AbortController` 闹钟要比它短（40s < 45s），否则用户看到的是英文黑话而不是「请重试」。Node 的 fetch 忽略 `eo`，本地不用分支。

## 改完跑什么

```powershell
cd app
node scripts/smoke-quota.mjs     # 代理边界：同源、额度、缺 key（离线，不联网）
node scripts/smoke-dedupe.mjs    # 去重口径（离线，不联网）
node scripts/smoke-plan.mjs      # 排期不冲突
node scripts/smoke-edge.mjs      # 时间倒挂、漏排、过期时段
node scripts/smoke-deadline.mjs  # 有截止的任务不排到截止之后
node scripts/smoke-reminder.mjs  # 打卡连续天数、提醒窗口、错过的提醒补发
npm.cmd run build                # 类型检查 + 构建
```

`smoke-parse` / `smoke-reasons` / `smoke-reorder` / `smoke-vision` / `smoke-start-time` / `smoke-habit` 需要 dev server 在跑（它们会真实调用模型）。

界面改动另跑真浏览器回归（Playwright + 本机 Edge，需要完全访问权限，否则浏览器管道报 EPERM）：

```powershell
node scripts/e2e-course-import.mjs   # 贴课表截图 → 本周课表出现、无任务时给引导、控制台无报错，截图存 deliverables/assets/test/
node scripts/e2e-habit-time.mjs      # 习惯按 20:00 开始、列表写「每天 20:00 开始」而不是「截止」，截图同上
node scripts/e2e-deadline-reminder.mjs  # 马上截止的事：不排到截止之后、立刻弹提醒，截图同上
node scripts/e2e-http-fallback.mjs   # 抹掉 crypto.randomUUID（模拟 http 打开）后，解析和排期照常
```

## 规则与拦法

| 规则 | 由什么拦住 |
|---|---|
| 交差前跑通测试；界面改动附截图 | `e2e-*.mjs` 四个（真浏览器 + 控制台报错检查） |
| 录入只追加、不覆盖已有活动 | 解析/截图都只经 `dedupeActivities`，没有别的写入路径 |
| 习惯按原文钟点开始，不默认 19:00 | `smoke-habit.mjs` |
| 有截止的任务不排到截止之后 | `smoke-deadline.mjs` |
| 提醒时刻错过、截止将至时要补发 | `smoke-reminder.mjs` |
| 代理超时不能用 `AbortSignal.timeout` | `smoke-quota.mjs`（模拟运行时缺这个 API） |
| 调模型必须显式调大平台的读超时，且黑话不外泄 | `smoke-quota.mjs`（`eo.timeoutSetting` 被删、或 502 直接透 `net_exception_timeout` 都会红） |
| 课表识别错了要能删、删完不回来 | `e2e-course-import.mjs`（删一行 + 刷新后仍是 9 行） |
| 非安全上下文（http）里不能用 `crypto.randomUUID` | `e2e-http-fallback.mjs`（先抹掉这个 API 再跑解析） |
| 单个文本文件不超 20 KB | `.githooks/pre-commit` |

## 提交前

仓库装了文件大小钩子（`.githooks/pre-commit`）：单个文本文件超过 20 KB（约 5000 token）就拒绝提交，图片、Office 文档、lockfile 不查。**没有白名单**，被拒就按报错把文件拆开再提交。

- 如果提交时报 `sh: couldn't create signal pipe`，是沙箱不允许钩子启动子 shell——用 `git commit --no-verify`，并在交付说明里写明这次跳过了钩子检查。

## 路标

- 为什么这么设计：`docs/decisions-schedule-app.md`（D1–D24）
- 怎么发布给别人用：`docs/deploy-edgeone.md`
- 提交材料：`deliverables/`（项目文档、PPT 大纲、演示视频脚本、配图）——**只留本地，已进 `.gitignore`，不要提交进仓库**
- 回归脚本：`app/scripts/`
