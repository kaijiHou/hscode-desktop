# HSCode ZCode 上传前复核

复核日期：2026-10-21（Asia/Shanghai）。本次范围为检查现有源码、避免上传密钥和本机隐私数据，并提交 GitHub；不是重新打包或完整运行验收。

## 源码与发布范围

- 实际工程为本机 `hscode-zcode` 工作区，上游基线为 `zai-org/ZCode` 的 `3c5b227649371507ddc4eb46ac5133afe6db1cab`。
- 用户提供的 ZIP 是实施说明和图标素材，不是成品源码；审核的是实际工作区内已完成的修改。
- 按用户此前“只保留最新源码”的要求，GitHub 使用独立分支 `codex/hscode-zcode-preview` 发布单次源码快照，不上传本机上游历史，也不改默认分支。
- 本机开发分支保留现有上游历史。保留 Apache-2.0 LICENSE、NOTICE 和第三方归属。
- 提交作者使用 GitHub 的 noreply 邮箱，不使用本机配置的个人邮箱。

## 代码检查结果

| 检查 | 本次结果 |
| --- | --- |
| 工作区新鲜度检查 | PASS：执行时开发分支与 origin/main 的 ahead/behind 均为 0 |
| `pnpm typecheck` | PASS：Node 24.22.0；首次使用默认堆上限时内存不足，设置 `NODE_OPTIONS=--max-old-space-size=6144` 后退出 0 |
| `pnpm lint` | PASS（0 errors，96 warnings）；未将警告写为零告警 |
| 定向 Vitest 回归 | PASS：5 个文件，57 passed、4 skipped，包含隐私门禁、反馈默认值及桌面运行环境 |
| `pnpm verify:pre-push` | Lint、数据库 schema 检查、架构工具单测（35 passed、1 skipped）及实际架构检查（0 违规）已通过；受影响测试先后因未提交工作区和默认基线 `origin/staging` 不存在而退出 2。公开上游实际基线为下述 SHA，需显式指定后补跑，不能把前两次整链运行记为通过 |
| 受影响测试显式基线补跑 | exit 0：选中 2053/2053 个规格，按仓库规则跳过整个根 UT 套件（未执行这些测试）；不能把跳过写为 2053 个测试通过，也不替代已实际执行的 57 项定向回归 |
| EXE 打包、真实启动与网络抓包 | NOT RUN：本次仅源码审核与上传，原验收文档中的待填项目仍未获得运行证据 |

定向测试命令：

受影响测试补跑已实际执行：`pnpm test:unit:affected --scope push --base 3c5b227649371507ddc4eb46ac5133afe6db1cab`。整链执行如需同一基线，可设置 `ZCODE_AFFECTED_TEST_BASE=3c5b227649371507ddc4eb46ac5133afe6db1cab`；不创建伪造的 origin/staging 引用。补跑日志保留在本机审核目录。

```text
pnpm exec vitest run scripts/test/hscode-privacy-guard.test.mjs packages/ui/test/feedbackSubmitFormRetry.test.ts packages/ui/test/feedbackBackgroundUploadIndicator.test.ts packages/ui/test/chatErrorBannerFeedbackDraft.test.ts packages/desktop/test/desktopRuntimeEnv.test.ts
```

## 上传隐私检查

- 从 Git 追踪文件与明确选中的新增源码、图标、文档导出待上传内容；不从整个工作目录打包上传。
- 完整初次扫描包含 18,275 个文件，Gitleaks 8.30.1 扫描约 151 MB；使用完整脱敏和忽略内联 allow 注释的模式。
- 原始结果为 63 条候选命中，不能写成工具原始报告零命中：29 条为 `third-party/inventory.json` 的 SHA256 文件校验值；其余为上游测试数据、资源命名空间、Provider ID、示例占位值和 WebSocket 标准示例。复核未确认真实凭据。
- 对本机用户目录、电脑标识和 SID 的附加搜索未命中待上传源码。候选文件清单没有 auth.json、credentials.json、数据库、日志、私钥、依赖缓存或桌面构建产物。
- `.agent-context/` 下的本机记录、原始扫描报告与源码检查副本不上传；私有构建配置同样排除。最终 18,276 个文件已逐个核对 Git blob SHA，与扫描副本一致，没有额外文件；复扫仍为已审查的 63 条候选，新增未审查候选为 0。之后仅补录本报告和修正品牌文档的打包字段说明，另做文本扫描。
- 检查结果是工具扫描及源码复核的证据，不代表对任意编码或隐藏内容作出绝对无泄漏保证。

## 已确认仍需后续处理的问题

1. **业务数据隔离未完成。** Electron userData/sessionData 名称已改变，但 `desktopDataBaseDirBootstrap.ts` 仍读取 `.zcode/v2/setting.json`，`packages/services/src/paths.ts` 仍使用 `.zcode` 业务根，桌面 Host 环境明确保留共享业务数据。模型凭据与会话不能据此判定隔离。原隐私审计中的错误结论已更正。
2. **并装协议冲突仍存在。** `electron-builder.config.js` 仍注册 `zcode://`，最后注册的应用成为默认处理程序，可能影响官方登录或远控回调。AUMID 不解决此问题。
3. **运行验证不完整。** 原记录中仍有 EXE、冷启动和空闲网络采样、登录、自建 Provider、Terminal/Browser/Workflow/Remote 等待填或 NOT RUN 项目，不能称为已完成全部产品验收。

本轮仅更正审计文档并补充本机资料排除规则，没有擅自修改上述业务逻辑，也没有重新生成安装包。

本次 GitHub 分支用于保存已扫描的最新源码，不表示完整产品验收或整条提交前检查已经通过。发布采用独立的本机 bare 仓库发送该单次快照；开发仓库的历史和 hook 配置保留。完整检查日志和 Git 对象索引修复记录保存在本机审核目录，不公开上传。
