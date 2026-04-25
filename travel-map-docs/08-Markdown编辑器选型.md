# 08｜Markdown 编辑器选型（开源高分 + 适配本项目）

> 目标：从 GitHub 上选择一个“成熟、维护活跃、可深度定制”的 Markdown 编辑器，能够融入我们的 UI（暗色 + 霓虹蓝、右侧正文 Tab）、并能对接“本地复制 + 可选 R2 同步”的图片/附件链路。

## 1. 本项目对编辑器的硬需求

1) 输出/存储：以 **Markdown 文本**为主（参考 Quartz 思路，内容可长期可迁移）  
2) UI：暗色主题、可自定义工具栏/快捷键、能嵌入 React/Electron  
3) 图片：需要提供“上传钩子/回调”以接入：
- 本地复制入库（城市/旅行目录结构）
- 可选上传到 Cloudflare R2，写入 URL
4) 扩展：后续可能需要 wiki-link（如 `[[西湖]]`）、Callout、任务清单、Mermaid 等

## 2. 候选方案（GitHub 高分）

### A. TOAST UI Editor（nhn/tui.editor）
- Star：17.9k+（高分老牌）  
- 形态：Markdown + WYSIWYG 双模式，提供 React wrapper  
- 风险点：仓库近年提交相对少（需要你接受“稳定但不那么活跃”的维护节奏）  
参考：<https://github.com/nhn/tui.editor>

### B. Milkdown（Milkdown/milkdown）
- Star：11.4k+，并且 2026 仍在活跃更新  
- 形态：插件驱动的 WYSIWYG Markdown 编辑器框架（ProseMirror + remark）  
- 优点：扩展能力强，长期适合“像 Quartz 一样逐步做成知识库”  
参考：<https://github.com/Milkdown/milkdown>

### C. Vditor（Vanessa219/vditor）
- Star：10.9k+，中文生态强，功能非常全  
- 形态：支持 WYSIWYG / Typora-like（IR）/ 分屏预览（SV）  
- 优点：集成快、内置上传/粘贴/工具栏能力多；适合做“个人写作工具”  
- 注意：不是 React 原生组件，通常通过 DOM 容器挂载（React 用 ref 包一层）  
参考：<https://github.com/Vanessa219/vditor>

### D. react-md-editor（uiwjs/react-md-editor）
- 形态：React 组件、基于 textarea，集成非常简单  
- 优点：上手最快、依赖少、暗色支持、适合 MVP  
- 限制：高级编辑体验/可扩展性不如 ProseMirror/Codemirror 体系  
参考：<https://github.com/uiwjs/react-md-editor>

### E. ByteMD（pd4d10/bytemd）
- Star：1.3k+  
- 形态：Svelte 核心 + React wrapper，插件体系清晰，支持 `uploadImages` 钩子  
- 风险点：总体热度/维护强度不如前三者  
参考：<https://github.com/pd4d10/bytemd>

## 3. 推荐结论（按阶段）

### 推荐（长期主线）：Milkdown
如果你希望最终把“旅行记录正文”做成接近 Quartz 那种可扩展的知识库体验（wiki-link/自定义块/更强的编辑体验），Milkdown 的框架化与活跃维护最适合做“主编辑器内核”。

### 推荐（快速 MVP）：Vditor
如果你希望 **尽快**把“站内写作 + 图片粘贴上传 + 分屏/即时渲染”做得像成熟写作软件，Vditor 是落地速度最高的一类，且国内使用者多、踩坑资料丰富。

> 我们也可以采取：先 Vditor 做 MVP → 后续若需要更强的“知识库化”扩展，再评估迁移到 Milkdown。

## 4. 与本项目的关键集成点（无论选谁）

### 4.1 图片插入协议（建议）
编辑器侧最终只需要拿到一个 Markdown 片段，例如：
- `![caption](local://assets/cities/.../{assetId}__IMG_0001.jpg)`（本地）
- 或 `![caption](https://<r2-public>/.../IMG_0001.jpg)`（远端）

应用内部决定：
- 本地优先展示；缺失再走 remote_url
- 导出 zip 时把本地 assets 打包，确保可恢复

### 4.2 上传钩子需要做的事
1) 接收文件（拖拽/粘贴/选择）  
2) 复制到本地附件库（城市/旅行目录）  
3) 生成/更新 Asset 记录（local_path + 可选 remote_url）  
4) 返回最终可插入 Markdown 的 URL（本地协议或远端 URL）

## 5. 下一步（待你确认）

在 Milkdown 与 Vditor 中二选一作为 MVP 编辑器：
- 如果你追求“最快用起来、像 Typora 一样写”：选 **Vditor**
- 如果你追求“长期可塑性、知识库化扩展”：选 **Milkdown**

✅ 已确认：本项目选择 **Milkdown** 作为主编辑器。

编辑模式偏好：
- ✅ 已确认：以 **所见即所得（WYSIWYG）** 为主（仍以 Markdown 作为底层存储格式）。

图片插入体验（正文）：
- ✅ 已确认：支持 **粘贴/拖拽即上传并插入**（写作时高频使用）
  - 需要在编辑器侧接入上传钩子：接收文件 → 本地复制入库（城市/旅行目录）→ 可选同步 R2 → 将最终链接插入正文
  - ✅ 已确认：正文默认插入 **local://** 图片链接（离线优先；同步到 R2 后由渲染层用 remote_url 兜底）
  - ✅ 已确认：插入时机为“**先立刻插入 uploading 占位**”，待本地复制完成后自动替换为 `local://...`（同步到 R2 属于后台任务，不阻塞写作）
