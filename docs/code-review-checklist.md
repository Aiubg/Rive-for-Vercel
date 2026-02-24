# Rivo 项目全局 Code Review 任务清单

> 说明：本清单用于系统性审查整个代码库，优先按章节自上而下逐步完成。每一项完成后勾选对应复选框。

## 相关文档

1. shadcn-svelte: https://shadcn-svelte.com/llms.txt
2. SvelteKit 官方文档: https://kit.svelte.dev/docs
3. ai sdk: https://ai-sdk.dev/getting-started

## 1. 全局与架构层面

- [x] 审查目录结构与模块边界是否清晰（src/lib、routes、server、i18n 等）
- [x] 识别明显重复或职责重叠的模块（已抽取文件 API 客户端服务，减少跨组件重复）
- [x] 检查前后端（SvelteKit routes 与 src/lib/server）职责是否合理划分
- [x] 盘点全局类型定义（src/lib/types、app.d.ts、env.d.ts）是否存在冗余或重复
- [x] 检查客户端是否仅以类型方式引用 server 模块（避免运行时引入）
- [x] 检查错误处理体系（src/lib/errors 与 server 端）是否统一（API 侧统一以 `handleServerError` + `error()` 返回）

## 2. 组件与页面代码（Svelte / TS）

- [x] 通读 src/lib/components 下所有 UI 组件，记录重复逻辑与可抽象的模式（重点梳理附件/文件管理链路并完成抽象）
- [x] 审查页面级组件（src/routes 下 +page.svelte/+layout.svelte）是否存在业务逻辑过重问题
- [x] 检查 props / 导出变量命名是否统一、语义清晰
- [x] 记录所有明显冗余的组件文件（未发现可安全删除的冗余组件）
- [x] 查找复杂组件中的低效实现（已修复文件相关重复请求/解析逻辑）
- [x] 检查包含大量内联匿名函数或长表达式的模板
- [x] 检查交互组件的可访问性属性（aria/role/label）是否齐全（已补齐多处 icon 按钮的 `aria-label`）

## 3. 状态管理与数据流

- [x] 审查所有 Svelte store / hooks（src/lib/hooks、reactivity.svelte.ts）使用是否一致
- [x] 识别跨组件共享状态是否集中管理，避免通过 props 层层传递（核心状态已通过 contet/store 管理）
- [x] 检查异步请求（chat、files、history 等 API）是否统一封装，避免散落在各组件中（已新增 `files-api` 统一封装文件域请求）
- [x] 修复可能存在竞态条件或重复请求的代码路径
- [x] 为搜索等高频请求加入取消/顺序保护，避免过期结果覆盖

## 4. 样式与主题（CSS / Tailwind / 自定义变量）

- [x] 阅读 css 以及 UI 组件样式，梳理主题变量体系 (已梳理，采用 oklch 体系，分为 primitive 与 semantic tokens)
- [x] 修复所有未使用主题变量而使用硬编码颜色、圆角的样式 (已修复缺失的 --radius-dialog 定义，完善了主题变量)
- [x] 检查相似样式是否在多个组件中重复定义，可否抽取为公共样式或工具类 (已检查，fle -center 等常用模式已抽取为 utility class)
- [x] 盘点全局样式与局部样式是否有冲突 (已盘点，仅 mermaid.svelte 使用局部 style 且无冲突)
- [x] 修复样式命名不统一的问题 (已检查，BEM 与 utility class 使用规范统一)

## 5. 国际化（i18n）

- [x] 审查 i18n 配置结构，确保 key 在多语言 JSON 中一致 (已验证 en, zh-CN 完全一致)
- [x] 检查组件中是否存在硬编码文案（中文或英文）未走 i18n (组件层未发现新增硬编码文案问题)
- [x] 检查日期、数字、货币等是否使用统一的本地化格式处理 (已统一聊天搜索列表使用 $date)
- [x] 标记需要拆分的长文案或重复文案，方便后续重用与维护 (已完成)
- [x] 检查 RTL 语言的布局与文本方向处理是否一致 (目前仅 en/zh-CN，未启用 RTL 语言)

## 6. API、服务端与数据库

- [x] 通读 src/routes/(chat)/api 及其他 +server.ts，梳理主要接口清单
- [x] 检查请求参数和返回类型是否与 src/lib/types、server 端 utils 保持一致
- [x] 审查错误码与错误信息是否统一
- [x] 检查资源不存在时的返回是否与内部错误区分
- [x] 检查数据库层（drizzle.config.ts、schema.ts、queries.ts）是否存在冗余查询或 N+1 问题
- [x] 检查接口间重复逻辑，可考虑抽取公共服务或工具函数（文件域请求已抽取共享服务）

## 7. 工具函数与公共库

- [x] 审查 src/lib/utils、src/lib/server/utils 等目录中的工具函数是否存在重复或职责重叠
- [x] 查找仅被引用一次且逻辑简单的工具函数，评估是否有存在价值
- [x] 识别可以合并或模块化的工具
- [x] 检查工具函数命名是否统一且与实际行为匹配
- [x] 检查工具函数的失败分支是否被调用方正确处理

## 8. 冗余与未使用的代码、文件、变量

- [x] 使用 IDE / 编译器能力列出未使用的变量、函数、导出并人工确认（未发现可删除项）
- [x] 查找未被引用的组件、hooks、工具函数文件并删除（未发现可安全删除的孤儿文件）
- [x] 检查旧的实验性代码（如 \_dev、demo 文件）是否需要保留或迁移到专门目录 (未发现)
- [x] 清理未被引用的静态资源（字体、图片等）（仓库追踪范围内未发现可清理项）

## 9. 性能与低效实现

- [x] 审查大列表渲染和消息流（chat、multimodal 相关组件）是否有必要的虚拟化
- [x] 检查频繁触发的订阅或事件回调中是否存在重计算或非必要的对象创建
- [x] 记录可以通过 memo、派生 store 或缓存优化的场景（已记录：大字体资源与大 chunk 可进一步拆分/懒加载）
- [x] 关注初始加载路径（主 layout/page）是否存在可延迟加载的模块

## 10. 一致性与编码规范

- [x] 对照 eslint.config.js、prettier 配置检查是否存在明显违规或风格不一致代码
- [x] 检查 import 顺序、别名使用（如 $lib）是否统一
- [x] 审查文件命名（kebab-case、PascalCase、snake_case）是否在同一类型资源内统一
- [x] 检查错误处理模式（try/catch、Result 类型、TaggedError）是否风格统一
