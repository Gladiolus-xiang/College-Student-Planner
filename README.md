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
  edge-functions/ /api/chat 的唯一实现（线上跑边缘函数，本地跑同一份代码）
  server/         本地开发壳：读 .env、把 Node 请求翻译成 Web 标准请求
  src/lib/        提示词、规则排期引擎、打卡、提醒、识图
  scripts/        回归脚本（改完提示词先跑一遍）
docs/             决策记录 + 部署说明
deliverables/     项目文档、PPT 大纲、演示视频脚本、配图
scripts/          文档与配图生成脚本
```

## 核心设计

**时间由代码算，理由由模型写。** 模型负责理解文字/截图、解释决策；规则引擎负责时段计算、冲突检查与完整性校验——模型出错时，计划依然合法。

## 给别人用（部署）

页面和 `/api/chat` 一起部署到腾讯 EdgeOne Makers 免费版：国内直连、平台二级域名免备案、不用买服务器；密钥放平台环境变量，浏览器拿不到；每日额度用 KV 计数，防止链接被转发后刷爆余额。

步骤见 [`docs/deploy-edgeone.md`](docs/deploy-edgeone.md)（30–40 分钟，含 5 分钟验收清单）。手机上是单列布局，拍照/相册入口走文件选择器。

## 常见问题

| 现象 | 原因 | 处理 |
|---|---|---|
| `禁止运行脚本` | PowerShell 执行策略 | 用 `npm.cmd` |
| 「缺少 DEEPSEEK_API_KEY」 | `.env` 没填 | 填好保存，刷新页面即可 |
| `401` | key 不对或不是 DeepSeek 的 | 去 platform.deepseek.com 重新复制 |
| 识图卡住或超时 | 图片太大 / 网络慢 | 重试一次；仍失败就换清晰点的截图 |
| `429`「今天的 AI 额度用完了」 | 每日调用上限（默认 400 次 / 单设备 30 次） | 调大 `DAILY_LIMIT`，或等次日 0 点 |
| 手机上收不到系统通知 | iPhone 的 Safari 不支持网页通知 | 页面右下角仍有提醒；说清这个边界即可 |

详见 `docs/decisions-schedule-app.md`。
