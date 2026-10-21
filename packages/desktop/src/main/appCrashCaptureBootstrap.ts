import { logger } from "./logger.js";
import { initializeCrashCapture, type CrashCapturePaths } from "./desktopCrashCapture.js";

// 须在 appARMSBootstrap 之前完成：先由 desktopEarlyDataBaseDirBootstrap 注入 dataBaseDir，再配置 crashDumps。
// HSCode Preview：remoteCrashReporterEnabled=false，启用仅本地的 crashReporter（uploadToServer: false）；
// 崩溃 dump 只留在本机隔离目录，不做任何远端传输。
export const crashCapturePaths: CrashCapturePaths = initializeCrashCapture(logger, false);
