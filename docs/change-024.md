# CHANGE-024 — Network Inspector UX V2

## Summary
重写网络检查器面板：共享 wire types（main/preload/renderer 同源）、IPv4/IPv6/TCP/UDP 完整协议头解析、惰性 detail 构建、UI v2 五 Tab 协议头展示、内部 List/Detail 可拖 splitter + detailWidth 持久化、外部 ResizeHandle 接入 Network 模式。

## New Files
- `packages/app/src/network-types.ts` — shared serializable wire types
- `packages/app/src/components/network/network-packet-list.tsx` — packet list component
- `packages/app/src/components/network/network-packet-detail.tsx` — detail inspector (5 tabs)
- `scripts/uxv2-*.cjs` — E2E verification scripts

## Modified Files
- **parser.ts** — 新增 Ipv4HeaderInfo / Ipv6HeaderInfo / TcpHeaderInfo / UdpHeaderInfo 结构化类型；parseTcp/parseUdp/parseIpv4/parseIpv6 返回完整 header；TCP options 解析（MSS/WS/SACK/TS/Unknown）；buildDetail 使用复用 header 函数
- **parser.test.ts** — 78 tests（含 TCP options/UDP header/IPv4 detail/IPv6 detail）
- **capture-service.ts** — rawPackets Map 存储原始包字节；detail() 惰性构建（先查缓存，再从 raw 构建）；clear() 清理 rawPackets
- **network-ipc.ts** — get-detail 返回 ip/tcp/udp/isText 结构化字段
- **preload/types.ts** — 引用 @opencode-ai/app/network-types 同源类型
- **network-panel.tsx** — 完全重写：Agent/IDE 工作台风格（Header 一键式/Filter Toolbar/PacketList ⇄ DetailInspector）
- **network-panel.test.tsx** — 更新 UI 契约测试
- **layout.tsx** — layout.store.network 新增 width / detailWidth / detailCollapsed 持久化
- **session.tsx** — desktopResizableSidePanelOpen + networkPanelResizedWidth + expandNetwork/restoreNetwork
- **app/package.json** — exports 新增 "./network-types"

## Runtime Verification (管理员模式)
- TCP capture: 442 packets captured, IPv4-TCP structured header 完整显示
- UDP capture: 3 packets (127.0.0.1:8081), IPv4-UDP structured header 完整显示
- Stop/Clear: 状态机正常

## Known Limitations
- CDP Input events in Electron don't trigger SolidJS pointer/mouse events → outer resize/splitter E2E 无法自动化验证
- 外层拖拽 edge direction 保持默认（edge=end）：向左拖 network 变窄，向右拖 network 变宽
- expand/restore 按钮代码已实现但未 E2E 验证
