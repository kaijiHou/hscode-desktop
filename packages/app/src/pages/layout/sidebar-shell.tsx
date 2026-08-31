import { createEffect, createMemo, For, Show, type Accessor, type JSX } from "solid-js"
import {
  DragDropProvider,
  DragDropSensors,
  DragOverlay,
  SortableProvider,
  closestCenter,
  type DragEvent,
} from "@thisbeyond/solid-dnd"
import { ConstrainDragXAxis } from "@/utils/solid-dnd"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Tooltip, TooltipKeybind } from "@opencode-ai/ui/tooltip"
import { type LocalProject } from "@/context/layout"

export const SidebarContent = (props: {
  mobile?: boolean
  opened: Accessor<boolean>
  aimMove: (event: MouseEvent) => void
  projects: Accessor<LocalProject[]>
  renderProject: (project: LocalProject) => JSX.Element
  handleDragStart: (event: unknown) => void
  handleDragEnd: () => void
  handleDragOver: (event: DragEvent) => void
  openProjectLabel: JSX.Element
  openProjectKeybind: Accessor<string | undefined>
  onOpenProject: () => void
  renderProjectOverlay: () => JSX.Element
  settingsLabel: Accessor<string>
  settingsKeybind: Accessor<string | undefined>
  onOpenSettings: () => void
  helpLabel: Accessor<string>
  onOpenHelp: () => void
  renderPanel: () => JSX.Element
}): JSX.Element => {
  const expanded = createMemo(() => !!props.mobile || props.opened())
  const placement = () => (props.mobile ? "bottom" : "right")
  let panel: HTMLDivElement | undefined

  createEffect(() => {
    const el = panel
    if (!el) return
    if (expanded()) {
      el.removeAttribute("inert")
      return
    }
    el.setAttribute("inert", "")
  })

  return (
      <div class="flex h-full w-full min-w-0 overflow-hidden">
        {/* HSCode Sidebar Rail — primary navigation column */}
        <div
          data-component="sidebar-rail"
          data-slot="hscode-sidebar-rail"
          class="w-[54px] shrink-0 flex flex-col items-center overflow-hidden border-r border-[var(--hs-border)]"
          style={{ background: "var(--hs-sidebar-bg)" }}
          onMouseMove={props.aimMove}
        >
          {/* Logo */}
          <div class="shrink-0 w-full flex flex-col items-center pt-3 pb-2">
            <div
              class="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: "var(--hs-accent)" }}
            >
              <span class="text-[10px] font-bold" style={{ color: "var(--hs-accent-fg)" }}>HC</span>
            </div>
          </div>

          {/* Primary actions */}
          <div class="shrink-0 w-full flex flex-col items-center gap-1 px-2 pb-2">
            <Tooltip
              placement={placement()}
              value={
                <div class="flex items-center gap-2">
                  <span>{props.openProjectLabel}</span>
                  <Show when={!props.mobile && !!props.openProjectKeybind()}>
                    <span class="text-icon-base text-12-medium">{props.openProjectKeybind()}</span>
                  </Show>
                </div>
              }
            >
              <IconButton
                icon="plus"
                variant="ghost"
                size="large"
                onClick={props.onOpenProject}
                aria-label={typeof props.openProjectLabel === "string" ? props.openProjectLabel : undefined}
              />
            </Tooltip>
          </div>

          {/* Project list (draggable) */}
          <div class="flex-1 min-h-0 w-full">
            <DragDropProvider
              onDragStart={props.handleDragStart}
              onDragEnd={props.handleDragEnd}
              onDragOver={props.handleDragOver}
              collisionDetector={closestCenter}
            >
              <DragDropSensors />
              <ConstrainDragXAxis />
              <div class="h-full w-full flex flex-col items-center gap-1 px-2 py-1 overflow-y-auto no-scrollbar">
                <SortableProvider ids={props.projects().map((p) => p.worktree)}>
                  <For each={props.projects()}>{(project) => props.renderProject(project)}</For>
                </SortableProvider>
              </div>
              <DragOverlay>{props.renderProjectOverlay()}</DragOverlay>
            </DragDropProvider>
          </div>

          {/* Bottom utilities */}
            <div class="shrink-0 w-full pt-2 pb-4 flex flex-col items-center gap-2 border-t border-[var(--hs-border)]">
              <TooltipKeybind placement={placement()} title={props.settingsLabel()} keybind={props.settingsKeybind() ?? ""}>
                <IconButton
                  icon="settings-gear"
                  variant="ghost"
                  size="large"
                  onClick={props.onOpenSettings}
                  aria-label={props.settingsLabel()}
                />
              </TooltipKeybind>
              <Tooltip placement={placement()} value={props.helpLabel()}>
                <IconButton
                  icon="help"
                  variant="ghost"
                  size="large"
                  onClick={props.onOpenHelp}
                  aria-label={props.helpLabel()}
                />
              </Tooltip>
            </div>
        </div>

        {/* Expanded panel */}
        <div
          ref={(el) => { panel = el }}
          classList={{ "flex-1 flex h-full min-h-0 min-w-0 overflow-hidden": true, "pointer-events-none": !expanded() }}
          aria-hidden={!expanded()}
        >
          {props.renderPanel()}
        </div>
      </div>
    )
}
