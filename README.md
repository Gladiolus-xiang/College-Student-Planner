# 今天做什么 · 大学生日程编排助手

杭州电子科技大学第二届 AIGC 应用创新大赛 · 赛题一作品原型。

把一段乱七八糟的群通知粘进来（或直接贴一张截图），自动拆成活动、排进课表空档、到点提醒、打卡记录，做不完一键重排。

## 运行

```powershell
cd D:\AIGC\app
notepad .env                 # 填 DEEPSEEK_API_KEY，保存
npm.cmd run dev              # 打开 http://localhost:5173
```

> 必须用 `npm.cmd`：Windows 默认禁止运行 `npm.ps1`，会报「禁止运行脚本」。
> 改 `.env` 不用重启：代理每次请求都重新读。

## 目录

```
app/              产品原型（Vite + React + TypeScript + Tailwind v4）
  server/         本地模型代理，API 密钥只在服务端
  src/lib/        提示词、规则排期引擎、打卡、提醒、识图
  scripts/        回归脚本（改完提示词先跑一遍）
docs/             决策记录（项目的唯一来龙去脉）
deliverables/     项目文档、PPT 大纲、演示视频脚本、配图
scripts/          文档与配图生成脚本
```

## 核心设计

**时间由代码算，理由由模型写。** 模型负责理解文字/截图、解释决策；规则引擎负责时段计算、冲突检查与完整性校验——模型出错时，计划依然合法。

## 常见问题

| 现象 | 原因 | 处理 |
|---|---|---|
| `禁止运行脚本` | PowerShell 执行策略 | 用 `npm.cmd` |
| 「缺少 DEEPSEEK_API_KEY」 | `.env` 没填 | 填好保存，刷新页面即可 |
| `401` | key 不对或不是 DeepSeek 的 | 去 platform.deepseek.com 重新复制 |
| 识图卡住或超时 | 图片太大 / 网络慢 | 重试一次；仍失败就换清晰点的截图 |

详见 `docs/decisions-schedule-app.md`。
