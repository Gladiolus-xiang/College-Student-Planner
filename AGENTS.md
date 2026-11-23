# AGENTS.md

大学生日程编排原型（杭电 AIGC 大赛 · 赛题一）。粘贴一段文字或一张截图 → 结构化活动 → 规则引擎排进课表空档 → 提醒 / 打卡 / 重排。

# 修改要求
  1.改完用Git存档
  2.修改后更新deliverables中的内容

## 跑起来

```powershell
cd app
npm.cmd run dev      # 必须 npm.cmd，Windows 禁 npm.ps1
```

`.env` 放 `DEEPSEEK_API_KEY`；代理每次请求重读，改完不用重启。

## 这个项目特有的坑

1. **时间由代码算，理由由模型写。** 绝不让模型输出具体时段——它会排出凌晨三点、占用上课时间。模型只给结构化字段、先后顺序和理由。
2. **模型输出必须过校验层**：缺 id 补回、时间格式归一、失败回退规则文案。任何「把模型 JSON 直接落库」的改动都是事故。
3. **文档真源是 `deliverables/项目文档-初稿.docx`**，不是 `scripts/build_doc.py`。整体重建会覆盖团队手改的内容；改文档要写一次性脚本按文本定位，改完删脚本。
4. **替换文档内配图要按「出现顺序」定位**，不能按图片部件 id，否则闭环图和架构图会对调。
5. 截图识别用 `deepseek-flash`，纯文字用 `deepseek-chat`，同一个 key，别混用。
6. 新增规则前先搜：时间解析统一走 `src/lib/time.ts` 的 `parseDeadline`；「只有日期 → 23:59 → fixed=false」只在 `prompts.ts` 的 `DATE_ONLY_RULE` 写一次。
7. **`/api/chat` 只有一份实现**：`app/edge-functions/api/chat.js`。`app/server/deepseek.ts` 只是把 Node 的 req/res 翻译成 Request/Response 的本地壳，不要在里面另写一份逻辑。线上跑边缘函数，本地跑同一个 `handleChat`。
8. **线上请求体上限 1 MB**（边缘函数的硬限制）。截图在前端压到 1280px / JPEG 0.82，超了自动降档；不要把 `MAX_BODY_CHARS` 调大，那只会把 413 从函数里挪到平台层。
9. 每日额度靠 KV，绑定变量名必须是 `QUOTA`；没绑定时代码自动跳过限流、不报错——所以「额度没生效」先查绑定，不是查代码。
10. 去重口径只有一处：`src/lib/dedupe.ts`（标题归一 + 截止时间）。别在 `App.tsx` 里另写一遍相等比较——两处口径迟早对不上。
11. 固定日程的 `deadline` 存的是**开始时刻**（`fixedInterval` 拿它当到场时间）。提示词里凡是「几点 + 有某事」都要判成 fixed，界面文案说「开始」不写「截止」。
12. 录入是「追加」不是「替换」：解析/截图结果先去重再 append，绝不能 `setItems(新数组)` 把已有活动冲掉。截图入口只有一个（`pickImage()`），视觉提示词只有 `buildScreenshotMessages`，不要再按课表/通知拆两条。

## 改完跑什么

```powershell
cd app
node scripts/smoke-quota.mjs     # 代理边界：同源、额度、缺 key（离线，不联网）
node scripts/smoke-dedupe.mjs    # 去重口径（离线，不联网）
node scripts/smoke-plan.mjs      # 排期不冲突
node scripts/smoke-edge.mjs      # 时间倒挂、漏排、过期时段
node scripts/smoke-reminder.mjs  # 打卡连续天数、提醒窗口
npm.cmd run build                # 类型检查 + 构建
```

`smoke-parse` / `smoke-reasons` / `smoke-reorder` / `smoke-vision` / `smoke-start-time` 需要 dev server 在跑（它们会真实调用模型）。

## 提交前

仓库装了文件大小钩子（`.githooks/pre-commit`）：单个文本文件超过 20 KB 拒绝提交。图片、Office 文档、lockfile 不查。

- 已知超标的 `app/src/App.tsx` 在钩子白名单里，属于历史遗留，暂时放行。
- 如果提交时报 `sh: couldn't create signal pipe`，是沙箱不允许钩子启动子 shell——用 `git commit --no-verify`，并在交付说明里写明这次跳过了钩子检查。

## 路标

- 为什么这么设计：`docs/decisions-schedule-app.md`（D1–D20）
- 怎么发布给别人用：`docs/deploy-edgeone.md`
- 提交材料：`deliverables/`（项目文档、PPT 大纲、演示视频脚本、配图）
- 回归脚本：`app/scripts/`
