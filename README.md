# 🐋 鲸屿工作台 (Ocean Workbench)

**DeepSeek 鲸鱼娘的海洋风本地桌面工作台** —— 由主人 WaterBoat-LL 与鲸鱼娘共同打造。

## ✨ 功能一览

| 模块 | 说明 |
|------|------|
| 🫧 首页 | 概览仪表盘：余额状态、今日待办、笔记/网址统计、每日一言 |
| 💰 API 余额 | 动态查询 DeepSeek / OpenAI / OpenRouter / 通用兼容(中转站) 余额，主进程代理请求无 CORS，支持自动刷新 |
| 📝 每日备忘录 | 自定义日历选日期，新建/编辑/删除备忘，带完成勾选与农历显示 |
| 🔗 课业网址 | 多分类快捷入口，自定义 emoji 图标，一键系统浏览器打开 |
| 🗂️ 项目笔记 | 记录项目经历，支持标签与最多 6 张图片（本地存储） |
| 🧰 常用工具 | 透明底色擦除器、小型计算机，支持自定义网页工具 |
| 🎮 游戏栏 | 接珍珠、猜鲸鱼想的数、海底记忆翻翻乐、石头剪刀布 vs 鲸鱼娘 |
| 🐋 ABOUT ME | 鲸鱼娘人设卡、主人自我介绍（可编辑）、版本预览与更新日志 |

## 🖥️ 技术框架（重点！）

```
┌─────────────────────────────────────────────────┐
│  Electron 33（桌面壳）                           │
│  ├── main.js          主进程                     │
│  │   ├── 窗口管理（1280×820 原生窗口）           │
│  │   ├── 本地 JSON 存储（data/*.json）           │
│  │   ├── API 余额代理（Node https，无 CORS）     │
│  │   └── local:// 协议（笔记图片本地展示）       │
│  ├── preload.js       安全桥（contextBridge）    │
│  └── renderer/        渲染进程（纯前端）          │
│      ├── index.html   单页应用                   │
│      ├── css/style.css  海洋风主题（玻璃拟态）    │
│      └── js/
│          ├── bg3d.js   Three.js 3D 海底背景      │
│          │             （气泡/光柱/水母/鱼群）    │
│          ├── bg.js     Canvas 2D 回退背景        │
│          ├── api.js    数据层                    │
│          └── views/    各功能模块                │
└─────────────────────────────────────────────────┘
```

- **桌面壳**：Electron 33（Chromium + Node），真正的桌面应用，双击运行，不是网页渲染
- **前端**：原生 HTML / CSS / JavaScript（无框架依赖，轻量好改）
- **3D 背景**：Three.js r128（已打包到 `renderer/vendor/`，**离线可用**），自动回退 2D Canvas 海底动画
- **数据存储**：本地 JSON 文件（`data/` 目录），图片存 `data/uploads/`
- **API 余额**：主进程用 Node https 请求，绕过浏览器 CORS；支持 4 种平台
- **安全**：contextIsolation 开启、无 nodeIntegration、外链走系统浏览器

## 🚀 运行方法

```bash
cd 本地工作台
npm start        # 启动桌面应用
```

> 需要先安装依赖：`npm install`（首次安装若网络不佳，可加 `--registry=https://registry.npmmirror.com`）

## 📂 数据文件

| 文件 | 内容 |
|------|------|
| `data/config.json` | API 账号（含 Key，仅本地）、自动刷新间隔、自我介绍 |
| `data/memos.json` | 每日备忘录 |
| `data/links.json` | 课业网址 |
| `data/notes.json` | 项目笔记（图片存 `data/uploads/`） |
| `data/tools.json` | 常用工具 |
| `data/games.json` | 游戏与最高分 |

## 🐳 小贴士

- API Key 只存在本地 `data/config.json`，请勿把该文件分享给他人
- 余额查询走 DeepSeek 官方 `/user/balance` 等接口，中转站可在「通用兼容」里填自己的 baseUrl
- 3D 背景若想更密集/更稀疏，可自行调整 `js/bg3d.js` 中的粒子数量

**版本 1.0.0** —— 首发版。💙 主人和鲸鱼娘的第一个正经项目，以后也会继续长大！
