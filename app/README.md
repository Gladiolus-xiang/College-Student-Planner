# 今天做什么 · 大学生日程规划（原型）

AIGC 大赛赛题一作品原型。技术栈：Vite + React + TypeScript + Tailwind v4，模型走 DeepSeek，密钥只在本地服务端。

## 第一次运行（3 步）

```powershell
cd D:\AIGC\app
notepad .env                 # 把 DEEPSEEK_API_KEY= 后面填上你的 key，保存
npm.cmd run dev              # 浏览器打开 http://localhost:5173
```

> 必须写 `npm.cmd` 而不是 `npm`：Windows 默认禁止运行 `npm.ps1`，会报「禁止运行脚本」。

## 每天开工的 2 条命令

```powershell
cd D:\AIGC\app
npm.cmd run dev
```

## 目录说明

```
app/
├─ server/deepseek.ts      本地代理：转发模型请求，密钥不进浏览器；每次调用写 logs/ai-calls.jsonl
├─ src/
│  ├─ App.tsx              当前页面（链路验证版）
│  ├─ types.ts             Activity / CourseSlot / PlanBlock 数据结构
│  ├─ lib/api.ts           前端调代理 + JSON 解析兜底
│  ├─ lib/prompts.ts       P1 抽取提示词（P2 排期 / P3 重排 待补）
│  └─ index.css            Tailwind 入口
├─ logs/ai-calls.jsonl     每次调用的模型、耗时、token（比赛文档附录素材，勿删）
└─ .env                    DEEPSEEK_API_KEY（不进 git）
```

## 常见问题

| 现象 | 原因 | 处理 |
|---|---|---|
| `禁止运行脚本` | PowerShell 执行策略 | 用 `npm.cmd`，或 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| 页面显示「缺少 DEEPSEEK_API_KEY」 | `.env` 没填或没重启 | 填好后重启 `npm.cmd run dev` |
| `模型接口返回 401` | key 错了 | 去 platform.deepseek.com 重新复制 |
| 安装依赖很慢 | 默认源在境外 | 已在本机用 `registry.npmmirror.com` 装好，一般不用再装 |
