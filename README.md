# 📕 小红书批量笔记生成器

多店铺 · 多账号 · AI 文案 + 封面图一键生成

## 功能特性

- **多店铺管理**：支持同时管理多个小红书店铺，每个店铺独立配置商品和账号
- **AI 智能生成**：基于大模型自动生成小红书种草笔记（标题、正文、标签、封面文案）
- **批量生成**：按店铺 × 账号 × 商品批量生成，支持自定义每个商品的生成篇数
- **爆文参考**：粘贴爆款笔记作为参考，AI 自动分析爆款因子并仿写
- **笔记采集**：支持 Excel/链接采集，并可导入标题裂变与商品参考
- **标题裂变**：输入爆款标题后自动分析并批量裂变
- **多配置切换**：支持保存多套 AI 配置并一键切换
- **封面图生成**：内置多种封面模板（格子速报风、便签手写风、笔记本横线风等）
- **一键导出**：支持导出 Excel 文案 + 封面图
- **本地存储**：所有数据保存在浏览器本地，不上传任何内容

## 技术栈

- **前端框架**：React 18 + Vite 6
- **封面渲染**：Canvas API
- **Excel 处理**：ExcelJS
- **AI 接口**：兼容 OpenAI 格式的 Chat Completions API
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

# 启动开发服务器（固定 3000 端口）
npm run dev
```

### 构建生产版本

```bash
npm run build
npm run preview
```

## 使用流程

```text
1. ⚙️ 设置 AI 配置（可新增多套并切换）
2. 🏪 创建店铺 → 添加商品 → 添加账号
3. 📥 (可选) 笔记采集并导入标题裂变/商品参考
4. 🔥 (可选) 标题裂变生成标题池
5. ✏️ (可选) 为商品配置爆文参考、风格模板、SEO规则、提示词
6. 🚀 批量生成笔记
7. 🎨 预览封面图
8. 📦 导出结果
```

## 模块使用方法

### ⚙️ Settings（AI 配置）

- 支持多套配置档案，例如：`字节方舟`、`aicodee`。
- 字段说明：
  - `API Key`：服务商密钥
  - `推理接入点 ID`：模型名或 endpoint id
  - `Base URL`：接口基址（常见为 `https://xxx.com/v1`）
- 使用方式：
  1. 在「当前配置」下拉选择配置。
  2. 不存在就点击「+ 新增配置」。
  3. 填写参数后自动保存，生成时按当前选中配置调用。

### 🏪 ShopManager（店铺管理）

- 新增、重命名、删除店铺。
- 每个店铺的数据隔离，互不干扰。
- 建议：按业务线拆店铺，避免商品和账号混用。

### 📦 ProductManager（商品管理）

- 维护商品基础信息：名称、描述、目标人群、核心卖点。
- 商品级增强能力：
  - 爆文参考（手动添加/管理）
  - 风格模板（启用/禁用）
  - 标题池（批量生成时轮换）
  - SEO 规则（关键词/标签约束）
  - 自定义提示词
- 建议：每个商品准备至少 3 条高质量参考。

### 👤 AccountManager（账号管理）

- 为店铺添加多个账号。
- 生成维度会按「商品 × 账号」展开。

### 📥 NoteCollector（笔记采集）

- 支持上传 Excel 或导入链接采集笔记。
- 常用动作：
  - 导入标题到「标题裂变」
  - 合并 Excel 文件
  - 打乱行顺序
- 适合先做素材汇总，再反哺到生成链路。

### 🔥 TitleFission（标题裂变）

- 输入爆款标题样本（建议 ≥3 条）后先 AI 分析。
- 设置目标商品后一键裂变生成多标题。
- 可回写商品标题池，供批量生成时轮换。

### 🚀 BatchGenerator（批量生成）

- 选择店铺、商品、账号与篇数后批量执行。
- 内置链路：文案生成 → 标题校验 → 去 AI 味 → SEO 修正 → 封面渲染 → Excel 写入。
- SEO 策略说明：
  - 优先执行一次 SEO 修正。
  - 若修正后仍不通过，降级放行并记录告警，不再无限重试。

### 🎨 CoverGallery / CoverCanvas（封面预览）

- 预览模板效果。
- 生成时按封面主标题/副标题渲染图片。

### 📋 NotePreview（笔记预览）

- 查看生成结果并做发布前复核。
- 建议检查标题长度、标签数量、商品词相关性。

## 项目结构

```bash
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── index.css
    ├── components/
    │   ├── ShopManager.jsx
    │   ├── ProductManager.jsx
    │   ├── AccountManager.jsx
    │   ├── NoteCollector.jsx
    │   ├── BatchGenerator.jsx
    │   ├── TitleFission.jsx
    │   ├── NotePreview.jsx
    │   ├── CoverCanvas.jsx
    │   ├── CoverGallery.jsx
    │   └── Settings.jsx
    ├── services/
    │   ├── aiService.js
    │   ├── humanizerService.js
    │   ├── seoService.js
    │   └── titleFissionService.js
    ├── templates/
    │   └── coverTemplates.js
    └── utils/
        ├── storage.js
        ├── excelMergeUtils.js
        ├── excelShuffleUtils.js
        ├── excelSplitUtils.js
        └── coverRenderer.js
```

## License

MIT
