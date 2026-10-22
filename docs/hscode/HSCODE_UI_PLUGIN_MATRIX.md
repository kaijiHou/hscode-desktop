# HSCode UI 插件来源与隔离验证矩阵

2026-10-22 用户已取消 PdfCraft、OpenPencil、PhotoCraft；当前仅保留 Excalidraw、上下文洞察。下列四项安装记录属于历史隔离验证，不代表实际使用的 HSCode 已安装，也不再要求重跑已取消插件。测试脚本已收缩至保留的两项。

**最终 CLI 结果（2026-10-22）：四个已审查发布物全部 PASS**。本轮仅执行一次新版 `--install`；来源 URL、版本和 SHA 均与审查固定值一致。OpenPencil 继续 NOT RUN；本脚本的 Electron/UI、文件编辑保存验收仍 NOT RUN，由主独立验证。

审查日期：2026-10-21。官方源码固定检查点：[`zai-org/zcode-plugins` `b773c5e4b136fb10d9da75b28398fa473a031729`](https://github.com/zai-org/zcode-plugins/tree/b773c5e4b136fb10d9da75b28398fa473a031729)。官方发布目录：[ZCode 官方 marketplace](https://cdn-zcode.z.ai/zcode/official-plugin/marketplace.json)。本表把仓库源码 manifest 与当前 CDN 发布分开记录；二者不一致时不推定为同一构建。

## 已核对的来源与发布物

| 插件            | 源码 manifest 版本 / license       | 当前官方目录版本 / ZIP（HEAD）/ SHA-256                                                                               | MCP 启动与 UI surface                                                                                                     | 依赖、文件与兼容边界                                                                                                                                                                                                                                                                                                                                             |
| --------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Excalidraw      | `0.3.4` / MIT                      | `0.3.4` / 16,278,945 B / `3ff2bbe7bfbf906bc19ee79cbbd3797daa5b6fb2f8b60513ca7793b7914ed7f3`                           | `stdio`，`node ${ZCODE_PLUGIN_ROOT}/dist/server.mjs`；`ui://excalidraw/panel.html`，`availability=session`                | README 要求 Node.js 24；编辑器与字体随包提供、无 CDN 依赖。支持 `.excalidraw`，导出 `.excalidraw`、PNG、SVG；单文档上限 5,000 元素 / 6 MiB。README 未声明 OS 专属限制。                                                                                                                                                                                          |
| Context Insight | 源码 manifest `0.1.0` / Apache-2.0 | **`0.1.1`** / 3,040,753 B / `2d43e50f54201d5d959fec66041d998da3dae3a6a8ea352cc02d3e00b331dd3a`                        | `stdio`，`node ${ZCODE_PLUGIN_ROOT}/dist/server.mjs`；`ui://zcode-context-insight/context.html`，`availability=session`   | **源码/CDN 版本不一致**：本轮 CLI 若成功安装，实测对象是 CDN `0.1.1`，不能归因到源码 `0.1.0`。README 要求 ZCode Desktop 3.15.1+、Node.js 24+；运行依赖随 `dist/` 打包。`dataRoot`、`dbPath` 可配置；空 `dataRoot` 会回退到 `HOME/.zcode/cli`。这是会话/文件活动只读分析面板，不作为文件编辑器；本轮 MCP 探测只请求静态 UI resource，不调用分析工具、不创建指标。 |
| PdfCraft        | `0.2.3` / MIT OR Apache-2.0        | `0.2.3` / 40,237,959 B / `d9dcc3c995fbeaab08eeab36fc0fc7f2bdda0bc8a1d561e76b13a768570c0996`                           | `stdio`，`node ${ZCODE_PLUGIN_ROOT}/dist/server.mjs`；`ui://pdfcraft/panel.html`，`availability=session`                  | Node.js 24+；宿主需支持 MCP Apps surface、WASM CSP 和 `ui/download-file`。PDF workspace import 上限 128 MiB；单操作最多 256 个输入 / 128 MiB；输出最多 128 MiB，宿主 Save As 导出最多 50 MiB。README 声明无运行时下载、不向外部服务发送文件；上游 PdfCraft 0.6.0，commit `4e53e5ffbd11bdb9edb086b472851ef894b55941`。                                            |
| PhotoCraft      | `0.2.3` / MIT OR Apache-2.0        | `0.2.3` / 24,380,476 B / `d0c29fa9e6af80a2c91c96a093f45dde44ef755deb09041953bf145048830d25`                           | `stdio`，`node ${ZCODE_PLUGIN_ROOT}/dist/server.mjs`；`ui://photocraft/panel.html`，`availability=session`                | Node.js 24+；同 PdfCraft，宿主需 WASM CSP 与 `ui/download-file`。workspace import 上限 128 MiB；单操作最多 256 个输入 / 128 MiB；输出最多 128 MiB，Save As 最多 50 MiB。README 声明无运行时下载、不向外部服务发送文件；上游 PhotoCraft 0.7.0，commit `649b1d5d92c08bf846631a868adc8a5c6ec6e888`。                                                                |
| OpenPencil      | `0.3.2` / MIT                      | 官方 marketplace **无条目、无可用目录 SHA**；按惯例路径发出的 HEAD 为 200、18,356,839 B，但未作为可信发布物下载或安装 | 源码 manifest：`stdio`，`node ${ZCODE_PLUGIN_ROOT}/dist/server.mjs`；`ui://openpencil/panel.html`，`availability=session` | manifest 描述 Figma `.fig` 编辑；`enableEval` 默认 `false`，启用后允许任意 Figma Plugin API JavaScript。当前目录缺少能把源码版本和该直链 ZIP 绑定起来的 SHA，故**不试装**；不构建、不下载仓库。                                                                                                                                                                  |

2026-10-21 HEAD 观测到的四个目录 ZIP 合计 **83,938,133 B（约 80.05 MiB）**。2026-10-22 新 run 成功刷新官方市场，逐项比较固定版本、URL、SHA，然后由现有 CLI 安装器完成下载/校验和安装。实际安装 manifest 的版本、license、surface/server/resourceUri/availability 均通过脚本断言；Context Insight 实装对象明确为 CDN `0.1.1`，不是固定源码提交中的 `0.1.0`。OpenPencil 在新 run 的官方目录仍无条目；其既有 HEAD 结果不作为可信安装来源。

## 2026-10-22 本机实际安装收尾

- 用户最终只保留 Excalidraw 与 Context Insight；下面四项安装结果为历史隔离试验，不是当前分发清单，取消项不再安装或打包。
- 修正 Main→Host 的 HOME/USERPROFILE/ZCODE_STORAGE_DIR 后，通过真实 HSCode 市场安装 Excalidraw 0.3.4；详情显示实际根在本 checkout 的 `.hscode-local-data/.zcode/cli/plugins/cache/zcode-plugins-official/excalidraw/0.3.4`，不再是系统用户的 `.zcode`。未删除原版目录。
- 本次真实刷新得到的官方 CDN 目录 46 条、合并内置目录 61 条，不含 zcode-context-insight；较早成功 run 的官方目录仍有其 0.1.1 和 SHA。二者是不同时间的观测，不把旧结果当成现在可安装，不用猜测直链强行安装。
- 无真实任务时精选入口保持“先创建任务”的真实状态；插件业务编辑/保存和完整 sandbox 生命周期未验收，不以安装完成冒充通过。

## Windows 历史隔离试装结果

最新 PASS run：`.agent-context/plugin-validation/runs/2026-10-22T00-54-08-954Z-xravfr/`；原始 [`result.json`](../../.agent-context/plugin-validation/runs/2026-10-22T00-54-08-954Z-xravfr/result.json) 总状态 `PASS`，`modelCalls=0`、`pluginToolCalls=0`。四个插件均安装并启用，实际安装根与数据路径通过隔离路径检查。

| 插件            | 实装版本 | 安装/启用/真实路径            | MCP 初始化 + 静态 UI resource | HTML 字符数 | Electron/UI/编辑保存 |
| --------------- | -------- | ----------------------------- | ----------------------------- | ----------: | -------------------- |
| Excalidraw      | `0.3.4`  | PASS                          | PASS                          |     618,438 | NOT RUN              |
| Context Insight | `0.1.1`  | PASS                          | PASS                          |     696,068 | NOT RUN              |
| PdfCraft        | `0.2.3`  | PASS                          | PASS                          |     628,091 | NOT RUN              |
| PhotoCraft      | `0.2.3`  | PASS                          | PASS                          |     629,195 | NOT RUN              |
| OpenPencil      | 未安装   | NOT RUN（无官方目录条目/SHA） | NOT RUN                       |           — | NOT RUN              |

四个 MCP 服务均使用已有 Node `v24.22.0` 在 Windows 启动，协商协议 `2025-03-26`，返回 `text/html;profile=mcp-app`。只发出 `initialize`、`notifications/initialized`、`resources/read`；没有执行模型或插件业务工具。实际安装根统一为新 run 下 `zcode-storage/cli/plugins/cache/zcode-plugins-official/<name>/<version>/`，实际插件数据路径也在该 run 内；逐项相对路径保存在报告中。

## 初次 run 失败历史（保留，不代表最新结果）

| 插件            | CLI 安装 / 实际路径 / MCP initialize + UI resource read                                                                     | Electron surface / 编辑保存                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Excalidraw      | **NOT RUN**：唯一 run 的目录发现预检 FAIL（`excalidraw missing from official CLI marketplace`），尚未执行安装命令或启动 MCP | **NOT RUN**：留给主协调                                           |
| Context Insight | **NOT RUN**：在 Excalidraw 预检处停止，未执行安装、分析工具或 MCP；未读取真实会话                                           | **NOT RUN**                                                       |
| PdfCraft        | **NOT RUN**：预检停止，未执行安装或 MCP                                                                                     | **NOT RUN**：宿主 WASM CSP、`ui/download-file` 和文件操作尚无实测 |
| PhotoCraft      | **NOT RUN**：预检停止，未执行安装或 MCP                                                                                     | **NOT RUN**                                                       |
| OpenPencil      | **NOT RUN**：未列入官方 marketplace、无目录 SHA；不使用未校验直链                                                           | **NOT RUN**                                                       |

初次 run：`.agent-context/plugin-validation/runs/2026-10-21T11-55-54-119Z-iKbWu0/`；原始 [`result.json`](../../.agent-context/plugin-validation/runs/2026-10-21T11-55-54-119Z-iKbWu0/result.json) 仍为 FAIL、空目标插件结果数组，未覆盖。该 CLI 当时只创建了 bundled seed 缓存，市场文件含 15 项且无目标插件；当时没有显式刷新官方市场。新版增加刷新后，在全新 run 成功完成四插件验证，因此旧预检失败不再是当前安装阻塞。历史诊断曾误用相对 CLI 路径产生 `MODULE_NOT_FOUND`，不计入插件验证。

验证入口 [`scripts/test/hscode-plugin-smoke.mjs`](../../scripts/test/hscode-plugin-smoke.mjs) 要求显式 `--install`。本次按主澄清授权仅执行一次 `node scripts/test/hscode-plugin-smoke.mjs --install`，按 Excalidraw → Context Insight → PdfCraft → PhotoCraft 顺序完成；未更改脚本后重试，也未复用旧 FAIL profile。无参数或 `--help` 仅打印说明。

隔离变量仅通过子进程 env 覆盖，未更改当前 shell HOME：`HOME`、`USERPROFILE`、`APPDATA`、`LOCALAPPDATA`、`HSCODE_HOME`、`ZCODE_HOME`、`ZCODE_DATA_BASE_DIR`、`ZCODE_STORAGE_DIR`、`ZCODE_PLUGIN_DATA`、`ZCODE_CONTEXT_DATA_ROOT`、`ZCODE_CONTEXT_DB_PATH` 均指向新 run。TEMP/TMP 使用约定的 `.agent-context/temp`。本脚本直接调用已构建的 `apps/zcode-cli/packages/cli/dist/zcode.cjs`；实际目标安装根已证实隔离，但 **Electron 内部 `_hscodeCli` 根、HSCODE_BUILD/flag 选择、surface 可用性、保存导出、sandbox 生命周期仍未由本脚本验收**。没有安装 Node、pnpm、Python、Rust 或新构建环境。

## 实际安装物的许可证与依赖观察

- Excalidraw：实装 manifest 为 MIT；根 `LICENSE` 为 MIT 文本，另有 `licenses/LICENSE`。分发需保留版权及许可声明。
- Context Insight `0.1.1`：实装 manifest 与根 `LICENSE` 为 Apache-2.0，`NOTICE` 列出 dsh-context、ZCode、离线 models.dev 快照、DeepSeek token 估算来源，并提到 MCP SDK 与 Zod。未调用分析工具；没有为本轮测试构造模型指标或开启完整 I/O 记录。
- PdfCraft / PhotoCraft：实际 `dist/BUILD.json` 的 pluginVersion 均为 `0.2.3`；上游版本/commit 分别为 `0.6.0` / `4e53e5ffbd11bdb9edb086b472851ef894b55941`、`0.7.0` / `649b1d5d92c08bf846631a868adc8a5c6ec6e888`，与来源审查相符。包内有 MIT、Apache、NOTICE、图标等许可材料；NOTICE 另列字体 OFL、Lucide ISC 等依赖，PhotoCraft 还列 SCOWL，不能把全部素材视为单一 MIT/Apache 授权。
- 两个 Craft 包的 `dist/licenses/LICENSE-brand.txt` 明确区分 ArtCraft 商标素材与开源代码：商标素材不受 MIT/Apache 授权；修改版分发涉及移除/替换商标及名称的条款。主整合不可把代码许可证当作品牌素材的任意改名或再利用授权；本轮未修改或分发这些安装物。
- 以上完成安装 manifest、许可证/NOTICE 位置及主要条款核对；**完整传递依赖清单与逐资产许可证闭环审计仍 NOT RUN**。静态 UI resource 返回成功也不证明 WASM 实际渲染、浏览器文件格式支持或宿主下载保存功能可用。

## 主要来源

2026-10-22 验证：脚本语法检查和无副作用 `--help` 通过；`architecture:check --changed` 为 0 违规。随后获准的新版 `--install` 单次运行以退出码 0 结束，四插件全部 PASS；本脚本的 Electron 验证仍 NOT RUN。本轮未启动任何子 agent。

- manifest、README 和可见许可证材料的来源目录（实际安装物证据见上节）：[Excalidraw](https://github.com/zai-org/zcode-plugins/tree/b773c5e4b136fb10d9da75b28398fa473a031729/external_plugins/excalidraw)、[Context Insight](https://github.com/zai-org/zcode-plugins/tree/b773c5e4b136fb10d9da75b28398fa473a031729/external_plugins/zcode-context-insight)、[PdfCraft](https://github.com/zai-org/zcode-plugins/tree/b773c5e4b136fb10d9da75b28398fa473a031729/external_plugins/pdfcraft)、[PhotoCraft](https://github.com/zai-org/zcode-plugins/tree/b773c5e4b136fb10d9da75b28398fa473a031729/external_plugins/photocraft)、[OpenPencil](https://github.com/zai-org/zcode-plugins/tree/b773c5e4b136fb10d9da75b28398fa473a031729/external_plugins/openpencil)。
- 发布版本、ZIP URL 与哈希：官方 [marketplace.json](https://cdn-zcode.z.ai/zcode/official-plugin/marketplace.json)。
- ZIP 长度：2026-10-21 对目录 URL 执行 HTTP HEAD；没有预先下载整包。
