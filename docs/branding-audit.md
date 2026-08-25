# HSCode 可见品牌审计（Visible Branding Audit）

> 目的：明确区分「用户可见的 HSCode 品牌」与「内部 OpenCode 名称」，防止后续 Agent
> 在品牌清理时误删内部包名/环境变量/协议兼容代码。
>
> 最后更新：2026-08-26（Phase 2A.1）

## 规则

- **处理对象**：用户看得到的品牌（应用名、首页水印、Logo、错误页、onboarding 文案、菜单）。
- **保留对象**：内部 `@opencode-ai/*` 包名、`OPENCODE_*` 环境变量、内部 service ID、
  兼容配置文件名、上游协议兼容代码、theme internal ID。
- 不要为了品牌清理去改动 Provider 名称（OpenAI/Anthropic/OpenCode Zen 等真实外部服务保留）。

## 审计表

| 位置 | 原内容 | 当前内容 | 是否用户可见 | 处理 |
|---|---|---|---|---|
| Legacy Home 大背景字 | `OpenCode Logo`（wordmark SVG） | `HSCodeSplash`（大号 HSCode 水印） | Yes | replaced (Phase 2A.1) |
| Error 页 Logo | `OpenCode Logo` | `HSCodeSplash` | Yes | replaced (Phase 2A.1) |
| Error 页 feedback 链接 | `https://opencode.ai/desktop-feedback` | `https://github.com/kaijiHou/hscode-desktop/issues` | Yes（主动点击） | replaced (Phase 2A.1) |
| Window title（electron 窗口） | OpenCode | HSCode | Yes | already fixed (Phase 1) |
| renderer HTML `<title>` | OpenCode | HSCode | Yes | already fixed (Phase 1) |
| manifest / webmanifest | OpenCode | HSCode | Yes | already fixed (Phase 1) |
| `Mark`（logo.tsx 抽象方块） | 抽象方块 | 保留 | 无文字，无法识别为 OpenCode | keep |
| `Splash`（logo.tsx 抽象方块） | 抽象方块 | 保留 | 无文字，无法识别为 OpenCode | keep |
| 新会话空状态 `Mark` | 抽象方块 | 保留 | 无文字 | keep |
| 品牌组件 | — | `HSCodeWordmark` / `HSCodeLogo` / `HSCodeSplash`（新 `app/src/components/brand/hscode-logo.tsx`） | Yes | added (Phase 2A.1) |
| 内部包名 | `@opencode-ai/ui` | unchanged | No | keep |
| 内部包名 | `@opencode-ai/app` | unchanged | No | keep |
| 环境变量 | `OPENCODE_*` | unchanged | No | keep |
| 配置文件名 | `opencode.toml` 等兼容 | unchanged | No | keep |
| 上游协议 | OpenCode protocol 兼容 | unchanged | No | keep |
| theme internal ID | `opencode-*` | unchanged | No（CSS 内部） | keep |
| WSL / Provider 名 | OpenAI/Anthropic/Zen 等 | unchanged | 真实外部服务 | keep |

## 品牌组件 API

`packages/app/src/components/brand/hscode-logo.tsx`

- `HSCodeWordmark` — 纯文本 wordmark（CSS，用主题变量，aria-label="HSCode"）
- `HSCodeLogo` — Mark + wordmark lockup
- `HSCodeSplash` — 大面积低透明度水印（首页/错误页背景字）

原则：无远程图片、无新增网络请求、支持 dark/light theme（用 `var(--text-1)` / `var(--icon-*)`）。

## 用户可见品牌规范（Checklist）

- [x] 首页看不到 OpenCode 大字（改为 HSCode 水印）
- [x] Error 页不用 OpenCode Logo
- [x] window title / manifest / webmanifest = HSCode
- [x] 新增功能（Network Inspector）有明确的 `Network` 入口
- [ ] onboarding 无产品自称 OpenCode（检查中——见 Known Issues）
