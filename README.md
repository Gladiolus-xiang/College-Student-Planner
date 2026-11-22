# 今天做什么 · 大学生日程编排助手

杭州电子科技大学第二届 AIGC 应用创新大赛 · 赛题一作品原型。

把一段乱七八糟的群通知粘进来，自动拆成活动、排进课表空档、到点提醒、打卡记录，做不完一键重排。

## 目录

```
app/              产品原型（Vite + React + TypeScript + Tailwind）
  server/         本地模型代理，API 密钥只在服务端
  src/lib/        提示词、规则排期引擎、打卡与提醒逻辑
  scripts/        回归脚本（改完提示词跑一遍）
docs/             方案与决策记录
deliverables/     项目文档初稿、PPT 大纲
scripts/          文档生成脚本
```

## 运行

```powershell
cd app
copy .env.example .env   # 填入 DEEPSEEK_API_KEY
npm.cmd install
npm.cmd run dev
```

> 必须用 `npm.cmd`：Windows 默认禁止运行 `npm.ps1`。

## 核心设计

**时间由代码算，理由由模型写。** 模型负责理解自然语言和解释决策，规则引擎负责时段计算、冲突检查与完整性校验——模型出错时，计划依然合法。

详见 `docs/decisions-schedule-app.md`。
