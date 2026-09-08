import { createMemo, createSignal, For, onMount, Show, type JSX } from "solid-js"
import { useNavigate, useLocation } from "@solidjs/router"
import { base64Decode, base64Encode } from "@opencode-ai/core/util/encode"
import { getFilename } from "@opencode-ai/core/util/path"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { useCommand } from "@/context/command"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { usePlatform } from "@/context/platform"
import { useServerSync } from "@/context/server-sync"
import { sortedRootSessions } from "@/pages/layout/helpers"
import { pathKey } from "@/utils/path-key"

const SIDEBAR_PANEL_WIDTH_MIN = 200
const SIDEBAR_PANEL_WIDTH_MAX = 480
const SIDEBAR_PANEL_WIDTH_KEY = "hscode.workbench.sidebar.panelWidth"

/**
 * HSCode Workbench Sidebar — the new-layout navigation column.
 *
 * [54px Rail][Expandable Panel][Main Workbench]
 *
 * Rail: brand, new session, project switch, settings, help — every action is
 * a real command/navigation. Panel: the current project's real session list
 * from the server store. Open/close state reuses `layout.sidebar`.
 */
export function WorkbenchSidebar(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const layout = useLayout()
  const serverSync = useServerSync()
  const command = useCommand()
  const language = useLanguage()
  const platform = usePlatform()

  // Current route: /server/:key/session/:id (new layout) or /:dir/session/:id
  const route = createMemo(() => {
    const seg = location.pathname.split("/").filter(Boolean)
    if (seg[0] === "server") return { serverKey: seg[1], sessionID: seg[3] }
    if (seg[1] === "session") return { dir64: seg[0], sessionID: seg[2] }
    return {}
  })

  const currentSession = createMemo(() => (route().sessionID ? serverSync().session.get(route().sessionID!) : undefined))

  // Project implied by the route alone — no fallback, so the rail's active
  // state only lights the project the user is actually viewing.
  const routeProject = createMemo(() => {
    const r = route()
    if (r.sessionID) return currentSession()?.directory
    if (r.dir64) {
      try {
        return base64Decode(r.dir64)
      } catch {
        return undefined
      }
    }
    return undefined
  })

  const projects = createMemo(() => layout.projects.list().slice(0, 8))

  const currentProject = createMemo(() => {
    const list = projects()
    const dir = currentSession()?.directory
    if (dir) {
      const match = list.find((p) => pathKey(p.worktree) === pathKey(dir))
      if (match) return match
    }
    return list[0]
  })

  const sessions = createMemo(() => {
    const project = currentProject()
    if (!project) return []
    const [store] = serverSync().child(project.worktree, { bootstrap: true })
    return sortedRootSessions(store, Date.now()).slice(0, 40)
  })

  const projectActive = (worktree: string) => {
    const dir = routeProject()
    return dir ? pathKey(dir) === pathKey(worktree) : false
  }

  const opened = () => layout.sidebar.opened()
  const [panelWidth, setPanelWidth] = createSignal((() => {
    const raw = Number(localStorage.getItem(SIDEBAR_PANEL_WIDTH_KEY))
    if (!Number.isFinite(raw) || raw < SIDEBAR_PANEL_WIDTH_MIN) return 240
    return Math.min(SIDEBAR_PANEL_WIDTH_MAX, raw)
  })())

  // The workbench sidebar defaults to visible — the rail alone reads as an
  // unfinished half-navigation. Users can collapse it; it reopens next launch.
  onMount(() => {
    if (!layout.sidebar.opened() && layout.projects.list().length > 0) layout.sidebar.open()
  })

  const openSession = (sessionID: string) => {
    const key = route().serverKey
    if (key) navigate(`/server/${key}/session/${sessionID}`)
    else if (currentProject()) navigate(`/${base64Encode(currentProject()!.worktree)}/session/${sessionID}`)
  }

  const openProjectSessions = (worktree: string) => {
    const [store] = serverSync().child(worktree, { bootstrap: true })
    const first = sortedRootSessions(store, Date.now())[0]
    const key = route().serverKey
    // Id-less session paths have no route in the new layout — land on the
    // project's most recent session (or home when it has none) instead.
    if (first && key) navigate(`/server/${key}/session/${first.id}`)
    else if (first) navigate(`/${base64Encode(worktree)}/session/${first.id}`)
    else navigate("/")
  }

  return (
    <div class="flex h-full min-h-0 shrink-0" data-component="workbench-sidebar">
      {/* Rail — primary navigation */}
      <div
        data-component="workbench-rail"
        data-slot="hscode-sidebar-rail"
        class="w-[54px] shrink-0 flex flex-col items-center overflow-hidden border-r border-[var(--hs-border)]"
        style={{ background: "var(--hs-sidebar-bg)" }}
      >
        <div class="shrink-0 w-full flex flex-col items-center pt-3 pb-3 border-b border-[var(--hs-border)]">
          <Tooltip placement="right" value={language.t("home.title")}>
            <button
              type="button"
              class="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer"
              style={{ background: "var(--hs-accent)" }}
              onClick={() => navigate("/")}
              aria-label={language.t("home.title")}
            >
              <span class="text-[10px] font-bold" style={{ color: "var(--hs-accent-fg)" }}>HC</span>
            </button>
          </Tooltip>
        </div>

        <div class="shrink-0 w-full flex flex-col items-center px-2 pt-2 pb-1">
          <Tooltip placement="right" value={language.t("command.session.new")}>
            <IconButton icon="edit" variant="ghost" size="large" onClick={() => command.trigger("session.new")} aria-label={language.t("command.session.new")} />
          </Tooltip>
          <Tooltip placement="right" value={opened() ? "收起侧栏" : "展开侧栏"}>
            <IconButtonV2
              variant="ghost-muted"
              size="large"
              onClick={() => layout.sidebar.toggle()}
              aria-label={opened() ? "收起侧栏" : "展开侧栏"}
            >
              <IconV2 name="sidebar-right" />
            </IconButtonV2>
          </Tooltip>
        </div>

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
                    onClick={() => {
                      openProjectSessions(project.worktree)
                      if (!opened()) layout.sidebar.open()
                    }}
                    aria-label={getFilename(project.worktree) || project.worktree}
                  >
                    {(getFilename(project.worktree) || "P").slice(0, 1).toUpperCase()}
                  </button>
                </Tooltip>
              )}
            </For>
          </div>
        </div>

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

      {/* Expanded panel — current project + real session list */}
      <Show when={opened()}>
        <div
          data-component="workbench-sidebar-panel"
          class="h-full shrink-0 flex flex-col min-h-0 overflow-hidden border-r border-[var(--hs-border)]"
          style={{
            width: `${panelWidth()}px`,
            background: "var(--hs-sidebar-bg, var(--v2-background-bg-layer-02))",
          }}
        >
          <Show
            when={currentProject()}
            fallback={
              <div class="flex-1 flex items-center justify-center px-4 text-center text-[12px] text-v2-text-text-faint">
                {language.t("sidebar.empty.title")}
              </div>
            }
          >
            {(project) => (
              <>
                <div class="shrink-0 px-3 pt-3 pb-2 border-b border-[var(--hs-border)]">
                  <div class="text-[13px] font-semibold text-v2-text-text-base truncate">
                    {project().name || getFilename(project().worktree)}
                  </div>
                  <div class="text-[11px] text-v2-text-text-faint truncate mt-0.5" title={project().worktree}>
                    {project().worktree}
                  </div>
                </div>
                <div class="flex-1 min-h-0 overflow-y-auto px-2 py-2">
                  <div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-v2-text-text-faint px-2 pb-1.5">
                    {language.t("sidebar.project.recentSessions")}
                  </div>
                  <Show
                    when={sessions().length > 0}
                    fallback={<div class="px-2 py-3 text-[12px] text-v2-text-text-faint">—</div>}
                  >
                    <div class="flex flex-col gap-0.5">
                      <For each={sessions()}>
                        {(session) => (
                          <button
                            type="button"
                            data-component="workbench-sidebar-session"
                            data-active={session.id === route().sessionID}
                            class="text-left min-h-[30px] px-2 py-1.5 rounded-md text-[13px] truncate transition-colors text-v2-text-text-secondary hover:text-v2-text-text-base hover:bg-v2-overlay-simple-overlay-hover"
                            classList={{
                              "bg-v2-overlay-simple-overlay-hover text-v2-text-text-base font-medium":
                                session.id === route().sessionID,
                            }}
                            onClick={() => openSession(session.id)}
                            title={session.title || session.id}
                          >
                            {session.title || session.id}
                          </button>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              </>
            )}
          </Show>
        </div>

        {/* Drag handle — resize the panel like the terminal splitters */}
        <div
          data-slot="workbench-sidebar-splitter"
          style={{ position: "relative", width: "8px", height: "100%", "flex-shrink": "0", cursor: "col-resize" }}
          onMouseDown={(e) => {
            if (e.detail > 1) return
            e.preventDefault()
            const startX = e.clientX
            const startWidth = panelWidth()
            document.body.style.userSelect = "none"
            document.body.style.overflow = "hidden"
            const onMove = (me: MouseEvent) => {
              const delta = me.clientX - startX
              const next = Math.min(SIDEBAR_PANEL_WIDTH_MAX, Math.max(SIDEBAR_PANEL_WIDTH_MIN, startWidth + delta))
              setPanelWidth(next)
            }
            const onUp = () => {
              localStorage.setItem(SIDEBAR_PANEL_WIDTH_KEY, String(panelWidth()))
              document.body.style.userSelect = ""
              document.body.style.overflow = ""
              document.removeEventListener("mousemove", onMove)
              document.removeEventListener("mouseup", onUp)
            }
            document.addEventListener("mousemove", onMove)
            document.addEventListener("mouseup", onUp)
          }}
        />
      </Show>
    </div>
  )
}
