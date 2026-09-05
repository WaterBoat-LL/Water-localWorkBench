# 🐋 鲸屿工作台 (Ocean Workbench)

**DeepSeek 鲸鱼娘的本地桌面工作台** —— 由主人 WaterBoat-LL 与鲸鱼娘共同打造。

## ✨ 功能一览

| 模块 | 说明 |
|------|------|
| 🔐 本地账号系统 | 全黑登录框，多账号切换，头像可上传 |
| 🫧 首页 | 概览仪表盘 |
| 💰 API 余额 | 查询 DeepSeek / Moonshot / 硅基流动 / 通义千问 / OpenAI / OpenRouter / 通用兼容 余额，主进程代理无 CORS，支持自动刷新 |
| 📝 每日备忘录 | 日历选日期 + 新建/编辑/删除 + 农历 |
| 📅 课表 | CSV 导入 / 粘贴 / 手动添加，卡牌式按星期排列，支持 UTF-8 / GBK |
| 🔗 课业网址 | 多分类快捷入口，一键系统浏览器打开 |
| 🗂️ 项目笔记 | 记录项目经历，标签 + 图片 |
| 🧰 常用工具 | 透明底色擦除器、小型计算机、**AI 生成 PPT**（DeepSeek 扩写 + dsh-ppt 渲染） |
| 🎮 游戏栏 | 接珍珠 / 猜数 / 翻翻乐 / 石头剪刀布，并收录 **Git 学习**（启动 Git Bash、身份配置、命令速查） |
| 🐋 个人主页 | change 风格深色个人页（大头像 + 名字 + 今日版本迭代预览），背景纯黑 |

## 🎨 UI 特点（v2.0）

- **背景**：自定义 UI 图 + 鼠标视差滑动（已移除 3D 水母动画）
- **顶栏**：无白条框架，圆球悬停高亮，左上角为当前用户头像
- **交互**：切换功能时「灭屏 → 亮屏」过渡（1s 内）

## 🖥️ 技术框架

- **桌面壳**：Electron 33（Chromium + Node），原生桌面应用
- **前端**：原生 HTML / CSS / JavaScript，无框架依赖
- **数据存储**：本地 JSON（`data/`），图片存 `data/uploads/`
- **安全**：contextIsolation 开启、无 nodeIntegration、外链走系统浏览器
- **版本管理**：本地 Git 仓库（见下）

## 🚀 运行方法

```bash
cd 本地工作台
npm install                              # 首次
npm start                                # 启动桌面应用
```

## 🐙 Git 仓库

项目已初始化为本地 git 仓库（分支 `main`）。`.gitignore` 已排除：

- `node_modules/`、`.npm-cache/` —— 依赖
- `data/` —— **API 密钥、密码哈希、上传图片等隐私，仅本地，不进仓库**
- `picture_station/` —— 个人素材
- `*.log`、`*.tmp`、`probe-*.js`

提交 / 推送：

```bash
git add .
git commit -m "改了什么"
git remote add origin https://github.com/<你的用户名>/<仓库名>.git   # 首次
git push -u origin main
```

> 因为 `data/` 等已排除，推送到公开仓库是安全的（不含任何密钥）。

## 📂 数据文件（全部本地，不进 git）

| 文件 | 内容 |
|------|------|
| `data/config.json` | API 账号（含 Key，仅本地）、自动刷新、自我介绍 |
| `data/users.json` | 本地账号（密码为加盐哈希） |
| `data/session.json` | 当前登录用户 |
| `data/*.json` | 备忘录 / 课表 / 网址 / 笔记 / 工具 / 游戏 |

**版本 2.0.0** —— 个人化改版：账号系统 + 视差背景 + 深色个人主页 + Git 版本管理。💙 主人和鲸鱼娘的第一个正经项目，继续长大中！
