// HSCode visible branding components.
// Kept separate from @opencode-ai/ui/logo (upstream internals stay untouched)
// so future upstream merges don't conflict. No external images, no network.

import type { JSX } from "solid-js"

/** Simple responsive CSS wordmark: "HSCode". */
export function HSCodeWordmark(props: { class?: string }) {
  return (
    <span
      data-component="hscode-wordmark"
      aria-label="HSCode"
      class={props.class}
      style={{
        "font-family": "var(--font-sans, ui-sans-serif, system-ui)",
        "font-weight": 700,
        "letter-spacing": "-0.02em",
        color: "var(--text-1, inherit)",
        "user-select": "none",
      }}
    >
      HSCode
    </span>
  )
}

/** Mark + wordmark lockup, matching the OpenCode Logo slot usage. */
export function HSCodeLogo(props: { class?: string; wordmarkClass?: string }) {
  return (
    <div
      data-component="hscode-logo"
      aria-label="HSCode"
      class={props.class}
      style={{
        display: "inline-flex",
        "align-items": "center",
        gap: "0.5rem",
      }}
    >
      <svg viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ width: "1em", height: "1.25em" }}>
        <path d="M12 16H4V8H12V16Z" fill="var(--icon-weak-base)" />
        <path d="M12 4H4V16H12V4ZM16 20H0V0H16V20Z" fill="var(--icon-strong-base)" />
      </svg>
      <HSCodeWordmark />
    </div>
  )
}

/** Background watermark slot (large, low opacity) for home pages. */
export function HSCodeSplash(props: { class?: string }) {
  const style: JSX.CSSProperties = {
    "font-family": "var(--font-sans, ui-sans-serif, system-ui)",
    "font-weight": 700,
    "letter-spacing": "-0.02em",
    color: "var(--text-1, inherit)",
    "user-select": "none",
    "pointer-events": "none",
  }
  return (
    <div data-component="hscode-splash" aria-label="HSCode" class={props.class} style={style}>
      HSCode
    </div>
  )
}