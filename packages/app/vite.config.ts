import { defineConfig } from "vite"
import desktopPlugin from "./vite"

// HSCode: Sentry sourcemap 上传插件已彻底移除（隐私清理），
// 构建产物不再上传到 Sentry，SENTRY_* 环境变量不再被读取。

export default defineConfig({
  plugins: [desktopPlugin],
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    port: 3000,
  },
  build: {
    target: "esnext",
    sourcemap: true,
  },
})