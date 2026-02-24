# 主题变量指南（精简版）

本项目当前采用“两层制”变量模型（颜色）：

1. 语义层：`src/styles/tokens/semantics.css`
2. Tailwind Bridge 层：`src/styles/theme.css`（`@theme inline`）

基础层仅保留 `primitives.css` 提供原始尺度；颜色常量直接定义在语义层和主题层，不再使用独立调色板文件。

## 1. 设计原则

1. 语义层是颜色意图的唯一来源。
2. Tailwind Bridge 只负责把语义变量暴露给 `bg-*`、`text-*`、`ring-*` 等类名消费。
3. `components.css` 仅保留结构变量（尺寸、圆角、边框参数、阴影参数），不承载颜色语义别名。
4. 不再新增历史兼容别名（旧变量名回流）。
5. 组件样式优先使用语义变量，不直接引用 `--palette-*`。

## 2. 分层与职责

### 2.1 基础层（Foundation）

- `src/styles/tokens/primitives.css`

职责：

1. 间距、字号、z-index、动效时长等原始尺度。
2. 颜色值在语义层与主题层变量中直接定义。

### 2.2 语义层（Semantic）

- `src/styles/tokens/semantics.css`

职责：

1. 核心语义色：`--background`、`--foreground`、`--card`、`--popover`、`--border`、`--ring` 等。
2. 状态语义色：`--primary`、`--secondary`、`--accent`、`--destructive`、`--success`、`--warning` 等。
3. 业务语义色：
4. `--chat-input`、`--chat-input-border`、`--chat-input-border-focus`
5. `--sidebar-*`
6. `--chart-*`
7. 亮色和暗色都在该层定义完整覆盖。

### 2.3 结构层（Component Structure）

- `src/styles/tokens/components.css`

职责（仅结构变量）：

1. 形状系统：`--shape-*`
2. 阴影参数：`--shadow-color`、`--shadow-intensity`
3. 表单参数：`--field-*`
4. 输入组参数：`--input-group-*`
5. 交互边框参数：`--interactive-*`

### 2.4 Bridge 层（Tailwind 映射）

- `src/styles/theme.css`

职责：

1. 暴露 `--color-*`、`--radius-*`、`--shadow-*`、`--z-*`、`--ease-*`、`--duration-*` 给 Tailwind v4。
2. 示例：`--color-chat-input: var(--chat-input)`，由 `bg-chat-input` 类消费。

## 3. 运行时边界（未变更）

1. 主题预设仍在 `src/styles/themes/*.css` 覆盖语义变量值。
2. `data-theme` 与主题 ID 机制不变。
3. `src/lib/theme/theme-manager.svelte` 仍读取 `--background` 同步 `meta[name='theme-color']`。

## 4. 已移除变量与替代关系

迁移时使用以下替代：

1. `--chat-input-bg` -> `--chat-input`
2. `--border-color-default` -> `--border`
3. `--border-color-control` -> `--field-border-color`
4. `--border-color-focus` -> `--field-border-color-focus`
5. `--border-color-invalid` -> `--field-border-color-invalid`
6. `--control-border-width` -> `--field-border-width`
7. `--control-border-color` -> `--field-border-color`
8. `--control-border-color-focus` -> `--field-border-color-focus`
9. `--control-border-color-invalid` -> `--field-border-color-invalid`
10. `--surface-chat-input` -> `--chat-input`

## 5. 禁止回流规范

`scripts/check-ui-conventions.mjs` 已加入以下限制：

1. 禁用 `--control-border-*`
2. 禁用 `--border-color-*`
3. 禁用 `--chat-input-bg`
4. 禁用 `--surface-chat-input`
5. 禁用兼容 fallback 写法：`var(--x, var(--y))`

## 6. 使用建议

1. 组件背景/文本/边框优先使用 `bg-background`、`text-foreground`、`border-border` 等语义类名。
2. 聊天输入框使用 `bg-chat-input`，边框由 `--chat-input-border*` 驱动。
3. `ui-border-control*` 统一走 `--field-border-*`，不要再引入 control-border 别名。
4. 新增颜色需求时，先加语义变量，再决定是否需要在 `theme.css` 暴露 Tailwind 映射。

## 7. 变更后检查清单

每次主题/变量改动后至少执行：

1. `pnpm run check:ui`
2. `pnpm run check`
3. `pnpm run test`
4. 手动检查亮/暗模式下聊天输入框背景与边框。
5. 手动检查侧边栏 hover/focus 的可读性。
6. 手动检查文件页 `ui-border-control` 的边界和 focus 状态。
