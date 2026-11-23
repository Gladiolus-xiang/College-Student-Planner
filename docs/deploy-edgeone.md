# 部署：让别人打开网址就能用

目标：`https://<随机名>.edgeone.app` 打开即用，AI 功能正常，你的 key 不出现在浏览器里。
预计 30–40 分钟，其中 10 分钟是注册和实名。

## 0. 这套东西是怎么跑的

```
浏览器（别人的手机 / 电脑）
   │  POST /api/chat
   ▼
EdgeOne Makers
   ├─ 静态文件：app/dist（页面本体）
   └─ 边缘函数：app/edge-functions/api/chat.js（转发给 DeepSeek）
          │
          ▼
      api.deepseek.com（key 在平台环境变量里）
```

代码里只有一份代理实现（`edge-functions/api/chat.js`）。本地 `npm run dev` 由 Vite 用 Node 跑它，线上由边缘函数跑它——所以本地测通 = 线上逻辑一致，只有「KV 额度」这一层线上才生效。

## 1. 把代码推到 GitHub

```powershell
cd D:\AIGC
git remote add origin https://github.com/<你的账号>/<仓库名>.git
git push -u origin main
```

- 仓库设成 **Private 也可以**，EdgeOne 授权后能读。
- `.env` 已在 `.gitignore` 里，key 不会被推上去。推完在 GitHub 上翻一眼，确认没有 `.env`。

## 2. 注册并开通

1. 打开 https://console.tencentcloud.com/edgeone/makers ，用微信/QQ 登录腾讯云。
2. 完成**实名认证**（个人，身份证 + 人脸，几分钟）。
3. 开通 **EdgeOne Makers** 服务（免费版，长期有效）。

## 3. 新建项目

「新建项目」→「导入 Git 仓库」→ 授权 GitHub → 选中刚才那个仓库。

构建配置按下表填（**最容易错的是根目录**）：

| 配置项 | 值 |
| --- | --- |
| 框架预设 | Vite（没有就选 Other） |
| 根目录 | `app` |
| 构建命令 | `npm run build` |
| 输出目录 | `dist` |
| Node 版本 | `22.21.1` |

`app/edgeone.json` 已经写了后三项，控制台里一致即可（控制台优先，两边一致最保险）。

## 4. 环境变量

项目设置 → 环境变量 → 添加：

| 名称 | 值 | 必填 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | `sk-...`（和本地 `app/.env` 同一个） | 必填 |
| `DAILY_LIMIT` | 每天总调用上限，默认 400 | 可选 |
| `IP_DAILY_LIMIT` | 单台设备每天上限，默认 30 | 可选 |

> 改完环境变量要**重新部署**才生效；旧部署不受影响，这是平台的规则。

## 5. KV：每日额度的计数器

只做第 4 步也能跑，但没有「每日上限」，链接被人转到陌生大群就只能看着扣钱。要开：

1. 控制台 → 存储 → KV → 开通（免费，1 GB/账号）。
2. 新建命名空间，名字随便，比如 `quota`。
3. 回到项目 → KV 存储 → 绑定命名空间，**变量名填 `QUOTA`**（代码里认这个名字）。
4. 重新部署。

绑定成功后，每次调用会往 `g_20261123` / `ip_20261123_xxxx` 这类 key 上 +1；到上限返回 429「今天的 AI 额度用完了」。

## 6. 验收（5 分钟，必须做）

手机**关掉 Wi-Fi 用 4G**，逐条过：

- [ ] 打开 `https://<你的域名>.edgeone.app`，页面 3 秒内出来
- [ ] 点「填入示例」→「AI 解析」，2–4 秒出活动列表
- [ ] 下方出现「未来 N 天 · 自动排期」，每块都有理由
- [ ] 点「🗓 课表截图」选一张课表图，能识别出课程
- [ ] 粘一条「X 分钟后截止」的事（或改一个截止时间到几分钟后），页面右下角立刻弹出提醒
- [ ] 电脑上打开同一网址，`Ctrl+V` 粘贴群通知截图能识别
- [ ] 换成别人手机打开，看到的是**空白页 + 示例课表**（不是你的数据）

任何一条不过，看下一节。

## 7. 常见问题

| 现象 | 原因 | 怎么修 |
| --- | --- | --- |
| 页面 404 | 根目录没填 `app` | 项目设置里改成 `app` 重新部署 |
| 页面能开，AI 报 404 | `edge-functions` 没被识别 | 确认 `app/edge-functions/api/chat.js` 在仓库里；还不行就把 `edge-functions/` 挪到仓库根目录再部署 |
| 500「没有配置 DEEPSEEK_API_KEY」 | 环境变量没加或没重新部署 | 加完再部署一次 |
| 401 | key 复制不全 | 去 platform.deepseek.com 用复制按钮重取 |
| 402 | 余额不足 | 充值 |
| 413 / 「这张图太大」 | 边缘函数请求体上限 1 MB | 前端已压到 1280px；仍然报就裁剪截图 |
| 429 | 当日额度用完 | 调大 `DAILY_LIMIT`，或等次日 0 点 |
| 403「这个地址只给本站页面用」 | 页面和接口不同源 | 用平台给的域名访问，不要直接调接口 |
| 401 + 一个「Tencent Edgeone」页面 | 打开的是**预览域名**，链接里的 `eo_token` 过期（3 小时） | 回控制台拿最新的预览链接；长期用请绑自定义域名 |
| 502「调用模型失败 / AbortSignal.timeout is not a function」 | 边缘运行时没有 `AbortSignal.timeout`（2026-11-23 已改成 `AbortController`） | `git push` 后重新部署即可 |
| 手机上没有系统通知 | iPhone 的 Safari 不支持网页通知 | 页面右下角 Toast 仍然有；演示时说清这一点 |

## 8. 之后的更新流程

改完代码 → `git push` → EdgeOne 自动重新构建（1–2 分钟）→ 网址不变。

不想用 GitHub 也可以本地直传（需要先 `npm i -g edgeone` 并 `edgeone login`）：

```powershell
cd D:\AIGC\app
npm.cmd run build
edgeone makers deploy dist -n schedule-demo
```

## 9. 故意不做的事

- **不绑自有域名、不备案**：平台二级域名够用；绑域名 + 中国大陆节点要备案，1–2 周，赶不上 11-28。
- **不做登录**：数据在各自浏览器的 localStorage 里，互不干扰；代价是换设备看不到自己的计划。
- **不做 7×24 承诺**：免费版没有 SLA，演示前几天别频繁改配置。
