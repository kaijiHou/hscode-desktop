import { cn } from "@/components/lib/utils.js";
import hscodeAppLogoUrl from "@/assets/branding/hscode-app-logo.png";

/** HSCode Preview 应用徽标（H 瓦片图，自带底板，深浅主题通用）。 */
export function ZCodeAboutLogo({ className }: { className?: string }) {
  return (
    <img
      src={hscodeAppLogoUrl}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn("shrink-0 rounded-[12%] object-cover select-none", className)}
    />
  );
}

/** HSCode Preview 文字词标：保持原 ZCode 词标的调用方式与配色（currentColor → 继承文字色）。 */
export function ZCodeWordmarkLogo({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("shrink-0 font-semibold tracking-tight whitespace-nowrap select-none", className)}
    >
      HSCode Preview
    </span>
  );
}
