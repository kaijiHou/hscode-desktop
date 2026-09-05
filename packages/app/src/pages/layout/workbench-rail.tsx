import { For, Show, type JSX } from "solid-js"
import { useNavigate, useLocation } from "@solidjs/router"
import { base64Encode } from "@opencode-ai/core/util/encode"
import { getFilename } from "@opencode-ai/core/util/path"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { useCommand } from "@/context/command"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { usePlatform } from "@/context/platform"

/**
 * HSCode Workbench Rail — the primary navigation column of the new layout.
 *
 * Real actions only: home, new session, per-project switch, settings, help.
 * Project routes reuse the same `/:base64(dir)/session` shape as the rest of
 * the app, so every entry navigates to a live page.
 */
export function WorkbenchRail(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const layout = useLayout()
  const command = useCommand()
  const language = useLanguage()
  const platform = usePlatform()

  const projects = () => layout.projects.list().slice(0, 8)

  const projectActive = (worktree: string) => location.pathname.startsWith(`/${base64Encode(worktree)}/`)

  const openProject = (worktree: string) => {
    navigate(`/${base64Encode(worktree)}/session`)
  }

  return (
    <div
      data-component="workbench-rail"
      data-slot="hscode-sidebar-rail"
      class="w-[54px] shrink-0 flex flex-col items-center overflow-hidden border-r border-[var(--hs-border)]"
      style={{ background: "var(--hs-sidebar-bg)" }}
    >
      {/* Brand */}
      <div class="shrink-0 w-full flex flex-col items-center pt-3 pb-3 border-b border-[var(--hs-border)]">
        <Tooltip placement="right" value={language.t("home.title")}>
          <button
            type="button"
            class="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer"
            style={{ background: "var(--hs-accent)" }}
            onClick={() => navigate("/")}
            aria-label={language.t("home.title")}
          >
            <span class="text-[10px] font-bold" style={{ color: "var(--hs-accent-fg)" }}>
              HC
            </span>
          </button>
        </Tooltip>
      </div>

      {/* New session */}
      <div class="shrink-0 w-full flex flex-col items-center px-2 pt-2 pb-1">
        <Tooltip placement="right" value={language.t("command.session.new")}>
          <IconButton icon="edit" variant="ghost" size="large" onClick={() => command.trigger("session.new")} aria-label={language.t("command.session.new")} />
        </Tooltip>
      </div>

      {/* Projects */}
      <div class="flex-1 min-h-0 w-full overflow-y-auto no-scrollbar">
        <div class="w-full flex flex-col items-center gap-1 px-2 py-1">
          <For each={projects()}>
            {(project) => (
              <Tooltip placement="right" value={getFilename(project.worktree) || project.worktree}>
                <button
                  type="button"
                  data-component="workbench-rail-project"
                  data-active={projectActive(project.worktree)}
                  class="w-8 h-8 rounded-md flex items-center justify-center cursor-pointer text-[11px] font-semibold border transition-colors"
                  style={{
                    background: projectActive(project.worktree)
                      ? "var(--hs-accent-tint, var(--v2-overlay-simple-overlay-hover))"
                      : "var(--v2-background-bg-layer-03, var(--v2-background-bg-base))",
                    "border-color": projectActive(project.worktree)
                      ? "var(--hs-accent, var(--v2-background-bg-accent))"
                      : "transparent",
                    color: projectActive(project.worktree)
                      ? "var(--hs-accent, var(--v2-background-bg-accent))"
                      : "var(--v2-text-text-muted)",
                  }}
                  onClick={() => openProject(project.worktree)}
                  aria-label={getFilename(project.worktree) || project.worktree}
                >
                  {(getFilename(project.worktree) || "P").slice(0, 1).toUpperCase()}
                </button>
              </Tooltip>
            )}
          </For>
        </div>
      </div>

      {/* Bottom utilities */}
      <div class="shrink-0 w-full pt-2 pb-4 flex flex-col items-center gap-2 border-t border-[var(--hs-border)]">
        <Tooltip placement="right" value={language.t("sidebar.settings")}>
          <IconButton icon="settings-gear" variant="ghost" size="large" onClick={() => command.trigger("settings.open")} aria-label={language.t("sidebar.settings")} />
        </Tooltip>
        <Tooltip placement="right" value={language.t("sidebar.help")}>
          <IconButton
            icon="help"
            variant="ghost"
            size="large"
            onClick={() => platform.openExternal("https://github.com/kaijiHou/hscode-desktop/issues")}
            aria-label={language.t("sidebar.help")}
          />
        </Tooltip>
      </div>
    </div>
  )
}
