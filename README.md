# 📕 小红书批量笔记生成器

多店铺 · 多账号 · AI 文案 + 封面图一键生成

## 功能特性

- **多店铺管理**：支持同时管理多个小红书店铺，每个店铺独立配置商品和账号
- **千帆导入**：一键从千帆平台同步商品数据，免去手动录入
- **AI 智能生成**：基于大模型自动生成小红书种草笔记（标题、正文、标签、封面文案）
- **批量生成**：按店铺 × 账号 × 商品批量生成，支持自定义每个商品的生成篇数
- **爆文参考**：粘贴爆款笔记作为参考，AI 自动分析爆款因子并仿写
- **自定义提示词**：每个商品可单独定制 System Prompt 和 User Prompt
- **封面图生成**：内置多种封面模板（格子速报风、便签手写风、笔记本横线风等），自动生成封面图
- **一键导出**：支持导出 CSV 文案 + ZIP 封面图打包下载
- **本地存储**：所有数据保存在浏览器本地，不上传任何内容

## 技术栈

- **前端框架**：React 18 + Vite 6
- **封面渲染**：Canvas API
- **文件导出**：JSZip + FileSaver
- **AI 接口**：兼容 OpenAI 格式的 Chat Completions API（默认火山引擎方舟）
- **数据存储**：LocalStorage

## 快速开始

### 环境要求

- Node.js >= 16
- npm >= 7

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/cbw6666/xiaohongshu_note.git
cd xiaohongshu_note

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 构建生产版本

```bash
npm run build
npm run preview
```

## 使用流程

```
1. ⚙️ 配置 AI API Key 和推理接入点
2. 🏪 创建店铺 → 导入商品 → 添加账号
3. 🔥 (可选) 为商品添加爆文参考
4. ✏️ (可选) 自定义提示词
5. 🚀 批量生成笔记
6. 📋 查看/编辑生成结果
7. 🎨 预览封面图
8. 📦 导出 CSV + 封面图 ZIP
```

## 项目结构

```
├── index.html                  # 入口 HTML
├── package.json
├── vite.config.js
├── public/
│   └── vite.svg
└── src/
    ├── main.jsx                # 应用入口
    ├── App.jsx                 # 主组件（路由/状态管理）
    ├── index.css               # 全局样式
    ├── components/
    │   ├── ShopManager.jsx     # 店铺管理
    │   ├── ProductManager.jsx  # 商品管理 + 爆文参考
    │   ├── AccountManager.jsx  # 账号管理
    │   ├── QianfanSync.jsx     # 千帆同步
    │   ├── BatchGenerator.jsx  # 批量生成
    │   ├── NotePreview.jsx     # 笔记预览/编辑
    │   ├── CoverCanvas.jsx     # 封面 Canvas 渲染
    │   ├── CoverGallery.jsx    # 封面模板预览
    │   ├── ExportPanel.jsx     # 导出面板
    │   └── Settings.jsx        # AI 配置
    ├── services/
    │   └── aiService.js        # AI 调用 + Prompt 构建
    ├── templates/
    │   ├── coverTemplates.js   # 封面模板定义
    │   └── noteTemplates.js    # 笔记模板定义
    └── utils/
        ├── storage.js          # LocalStorage 读写
        ├── exportUtils.js      # CSV/ZIP 导出
        └── coverRenderer.js    # 封面渲染工具
```

## AI 配置说明

本工具使用兼容 OpenAI 格式的 Chat Completions API。默认配置为火山引擎方舟平台：

| 配置项 | 说明 |
|---|---|
| API Key | 火山引擎方舟 API Key |
| 推理接入点 ID | 模型的 Endpoint ID |
| Base URL | `https://ark.cn-beijing.volces.com/api/v3`（默认） |

也可替换为其他兼容 OpenAI 格式的 API 服务。

## 封面模板

内置多种小红书风格封面模板，基于 Canvas 实时渲染：

- 🟡 格子速报风 — 黄色格子底 + 速报标签
- 📝 便签手写风 — 撕纸边缘 + 手写体
- 📓 笔记本横线风 — 白底横线 + 粗体黑字
- 更多模板持续添加中...

## License

MIT
