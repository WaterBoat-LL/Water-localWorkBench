# Water-localworkbench

## 主要功能：
| 模块 | 说明 |
|------|------|
| 账号 | 全黑登录框，多账号切换，头像可上传 |
| 首页 | 概览仪表盘 |
| 余额 | 查询 DeepSeek / Moonshot / OpenAI / OpenRouter / 通用兼容 余额，主进程代理无 CORS，支持自动刷新 |
| 备忘 | 日历选日期 + 新建/编辑/删除 + 农历 |
| 课表 | CSV 导入 / 粘贴 / 手动添加，卡牌式按星期排列，支持 UTF-8 / GBK |
| 网址 | 多分类快捷入口，一键系统浏览器打开 |
| 项目 | 记录项目经历，标签 + 图片 |
| 工具 | 透明底色擦除器、小型计算机、**AI 生成 PPT**（DeepSeek 扩写 + dsh-ppt 渲染） |
| 游戏 | 接珍珠 / 猜数 / 翻翻乐 / 石头剪刀布，并收录 **Git 学习**（启动 Git Bash、身份配置、命令速查） |
| 个人 | change 风格深色个人页（大头像 + 名字 + 今日版本迭代预览），背景纯黑 |

## UI设计

- **背景**：自定义 UI 图 + 鼠标视差滑动（已移除 3D 水母动画）
- **顶栏**：无白条框架，圆球悬停高亮，左上角为当前用户头像
- **交互**：切换功能时「灭屏 → 亮屏」过渡（1s 内）

## 技术框架

- **桌面壳**：Electron 33（Chromium + Node），原生桌面应用
- **前端**： HTML / CSS / JavaScript
- **数据存储**：本地 JSON（`data/`），图片存 `data/uploads/`
- **安全**：contextIsolation 开启、无 nodeIntegration、外链走系统浏览器

## 运行方法

```bash
cd 本地工作台
npm install                              # 首次
npm start                                # 启动桌面应用
```

