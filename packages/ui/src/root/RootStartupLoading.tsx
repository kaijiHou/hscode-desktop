import type { ReactNode } from "react";
import { cn } from "@/components/lib/utils.js";
import hscodeAppLogoUrl from "@/assets/branding/hscode-app-logo.png";

interface RootStartupLoadingProps {
  label: string;
  children?: ReactNode;
  busy?: boolean;
}

export function RootStartupLoading({ label, children, busy = true }: RootStartupLoadingProps) {
  return (
    <div
      // Web 端全局 html/body/#root 为 Electron 透明背景让路，React 接管后会替换 HTML 启动壳。
      // 这里必须由阻塞态自身承接主题背景，否则远控链接会在 Root 恢复期间继续露出浏览器白底。
      className="flex h-full min-h-dvh flex-col items-center justify-center gap-6 bg-background text-foreground"
      role="status"
      aria-busy={busy}
      aria-label={label}
      data-testid="root-startup-loading"
    >
      <HscodeStartupLogoBadge />
      {children}
    </div>
  );
}

/**
 * HSCode Preview 品牌徽章：整贴 H 应用瓦片图（自带深色圆角底板），
 * 保持原 ZCode 徽章的尺寸体系（titlebar 20px / default 96px）、阴影与呼吸动画节奏。
 */
export const ZCodeStartupLogoBadge = HscodeStartupLogoBadge;

export function HscodeStartupLogoBadge({
  animated = true,
  size = "default",
}: {
  animated?: boolean;
  size?: "default" | "titlebar";
}) {
  return (
    <div
      data-desktop-logo-badge={size === "titlebar" ? "true" : undefined}
      className={cn(
        "relative flex items-center justify-center bg-[linear-gradient(180deg,#000000_0%,#151718_100%)] before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:border before:border-[rgba(255,255,255,0.1)] before:content-['']",
        size === "titlebar"
          ? "size-5 rounded shadow-sm/20 before:border-white/20"
          : "size-24 rounded-3xl shadow-xl/20",
      )}
    >
      <img
        src={hscodeAppLogoUrl}
        alt=""
        aria-hidden="true"
        draggable={false}
        className={cn(
          "pointer-events-none size-full rounded-[inherit] object-cover select-none",
          animated && "animate-[hscode-logo-breathe_1.8s_ease-in-out_3s_infinite]",
        )}
      />
    </div>
  );
}

/** 兼容旧导出名：启动标志现为整贴 H 瓦片，className 语义与原 SVG 版本一致。 */
export function ZCodeStartupLogo({
  className,
  animated = true,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <img
      src={hscodeAppLogoUrl}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn(
        "pointer-events-none shrink-0 rounded-[inherit] object-cover select-none",
        className,
        animated && "animate-[hscode-logo-breathe_1.8s_ease-in-out_3s_infinite]",
      )}
    />
  );
}
