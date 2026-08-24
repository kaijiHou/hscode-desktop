# HSCode Network Inspector 架构

> 状态：Phase 2A MVP（Windows 第一版）
> 日期：2026-08-24

## Scope

Network Inspector 是 HSCode 内置的原生抓包功能：在应用内直接查看本机 TCP/UDP 流量，
不依赖任何外部抓包程序（Wireshark / tshark / Fiddler / Charles / mitmproxy / whistle）。

MVP 范围（Windows only）：
- IPv4 / IPv6、TCP / UDP / ICMP 基础识别
- 源/目的 IP、端口、协议、长度、时间戳、方向、TCP flags
- Raw payload + HEX/ASCII 显示
- Start / Stop / Clear、基础过滤、实时列表、点击详情
- 明文 HTTP/1.x 单包识别（GET/POST/PUT/DELETE/PATCH/HEAD/OPTIONS + path + version + Host）

**明确不做**（本轮）：HTTPS MITM/解密、HTTP/2、QUIC、完整 TCP 流重组、pcapng、
数据包修改/注入/重放、ARP/NAT/防火墙、Linux/macOS 抓包。

## Why WinDivert

WinDivert（https://reqrypt.org/windivert.html，v2.2.2，2022-09 官方发行）是
Windows 用户态包捕获库：
- 无需写内核驱动，用户态 API 即可捕获/嗅探网络包
- 完整 IPv6 与 loopback（localhost）支持
- 预构建二进制发行（`WinDivert.dll` + `WinDivert64.sys`），无需本机编译
- 许可：LGPL v3 / GPL v2 双许可（随个人项目集成合法）

关键 API（来自官方 `windivert.h`，非凭记忆）：
```c
HANDLE WinDivertOpen(const char *filter, WINDIVERT_LAYER layer, INT16 priority, UINT64 flags);
BOOL   WinDivertRecvEx(HANDLE handle, VOID *pPacket, UINT packetLen, UINT *pRecvLen,
                       UINT64 flags, WINDIVERT_ADDRESS *pAddr, UINT *pAddrLen, LPOVERLAPPED lp);
BOOL   WinDivertShutdown(HANDLE handle, WINDIVERT_SHUTDOWN how);
BOOL   WinDivertClose(HANDLE handle);
```
Filter 语言（官方 7.1 节）：`tcp.DstPort == 80`、`udp.DstPort == 53`、`tcp.Syn`、
`inbound`/`outbound`/`loopback`、`true`/`false`。

**权限要求**：`WinDivertOpen()` 需要管理员权限（官方文档原文：
"The calling application must have Administrator privileges."）。

## Why not TShark / Wireshark GUI / other tools

用户明确要求：抓包能力作为 HSCode 自己的一部分存在，不调用外部抓包软件。
TShark（Wireshark 的 CLI）依赖 Npcap/WinPcap 驱动且是独立安装的二进制；
Wireshark GUI 是独立应用；两者都不符合"内置"要求。
WinDivert 提供的是库级 API，可被 HSCode 直接调用并以应用自带方式分发
（DLL + 驱动随应用携带），因此选 WinDivert。

## Main / Renderer separation

```
Renderer (packages/app)
  │  UI：packet list / filter / detail / toolbar
  │  IPC（invoke network-* 通道）
  ▼
Electron Main (packages/desktop/src/main/network/)
  ├── capture-service.ts   Capture 生命周期状态机 + ring buffer + 广播
  ├── filter.ts            WinDivert filter 字符串映射/校验（可测纯函数）
  ├── native.ts            WinDivert DLL 原生边界（koffi FFI）
  └── parser.ts            IP/TCP/UDP/ICMP/HTTP/HEX 解析（纯 TS，可测）
  ▼
WinDivert.dll + WinDivert64.sys（resources/win/）
```

原则：
- Renderer 只负责 UI 与展示，不持有 native handle
- Main 持有驱动/抓包/解析/生命周期/资源清理
- IPC payload 必须可序列化（`PacketSummary` 纯对象，不跨进程传 Buffer）
- capture loop 在 Node worker thread（`node:worker_threads`）运行，不阻塞
  Electron main event loop

## Native Bridge

集成方式：**koffi**（FFI 库，v3.1.6，prebuilt binaries，零编译）。
备选方案与弃用理由：
- C/C++ N-API addon（官方 Option A）：需要 MSVC 编译工具链；本机无编译环境，
  且 Electron 多 ABI 维护成本高 → 弃用
- npm `windivert`（1.0.2，2015 年发布，9 年未维护，面向 WinDivert 1.x 老 API，
  [Zysen/node-divert]）→ 弃用
- koffi：活跃维护（3.x）、N-API prebuilt 二进制、可在 Electron Main 直接加载
  `WinDivert.dll` 并经 FFI 调用 → 选用

WinDivert 二进制：官方 2.2.2-A 发行版（`x64/WinDivert.dll` 47KB +
`x64/WinDivert64.sys` 94KB）置于 `packages/desktop/resources/win/`，随包分发。

加载行为：
- DLL 缺失/加载失败 → 结构化错误 `DLL_NOT_FOUND`，UI 显示
  "Network capture engine is unavailable."，主程序不 crash
- 无管理员权限 → `WinDivertOpen` 返回 INVALID_HANDLE_VALUE/ERROR_ACCESS_DENIED
  → 结构化错误 `ADMIN_REQUIRED`，UI 显示明确指引
- 驱动未安装 → 同样映射为结构化错误

## Packet Data Model

```ts
type PacketSummary = {
  id: string
  timestamp: number
  direction: "inbound" | "outbound"
  ipVersion: 4 | 6
  protocol: "TCP" | "UDP" | "ICMP" | "OTHER"
  sourceIp: string
  destinationIp: string
  sourcePort?: number
  destinationPort?: number
  length: number
  tcp?: { syn; ack; fin; rst; psh; urg; sequence?; acknowledgment? }
  payloadLength: number
  application?: { protocol?: "HTTP"; method?; path?; host? }
}
```
详情（detail cache，最多 500 条）：raw + payload + hex + ascii。

内存保护：summary ring buffer 上限 5000（超限丢最旧）；detail 缓存上限 500。
raw buffer 只存在于 detail cache，不复制到 UI store。

## Capture Lifecycle

状态机（非 boolean）：
```
idle → starting → capturing → stopping → idle
                  ↕            ↕
                  ↓            ↓
                 error ←───────┘
```
错误处理：Start already running / Stop when idle / native init 失败 /
admin 缺失 / driver 缺失 / invalid filter / capture 错误 / window close / app quit。

## Filtering

第一版实现明确、有限的 HSCode filter 语法（不冒充 Wireshark）：
```
tcp | udp | icmp                    协议
tcp.port == 22122                   双向端口
udp.port == 5000
src.ip == 192.168.1.10
dst.ip == 192.168.1.20
```
映射到 WinDivert capture filter（底层过滤），并通过 `WinDivertHelperCompileFilter`
/`WinDivertOpen` 失败返回 invalid-filter 错误。非法输入返回明确 validation error。

## HTTP MVP

包内检测（packet-local）：TCP payload 以 `GET / POST / PUT / PATCH / DELETE / HEAD /
OPTIONS` 开头 → 识别为 HTTP Request，解析 method / path / version / Host。
UI 可显示 Protocol=HTTP，但 transport 底层保留 TCP。

边界声明：
> HTTP parser currently detects complete request headers contained in one
> captured TCP payload. TCP stream reassembly is planned for a later phase.

## Current limitations

- 单包 HTTP 识别（跨包分片不重组）
- 无 HTTPS 解密（仅可识别 443/TLS 外形）
- 无 pcap 导出
- 仅 Windows x64
- 需要管理员权限（非管理员显示引导，不 crash）
- 无进程/PID 关联

## Future roadmap

Phase 2B：TCP 流跟踪与重组、HTTP 请求/响应配对、HTTP body 查看、
WebSocket ws://、PCAP 导出、进程关联。