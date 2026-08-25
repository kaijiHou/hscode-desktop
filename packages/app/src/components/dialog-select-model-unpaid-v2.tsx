import { DialogBody, DialogHeader, DialogTitle, DialogV2 } from "@opencode-ai/ui/v2/dialog-v2"
import { Icon } from "@opencode-ai/ui/v2/icon"
import { ProviderIcon } from "@opencode-ai/ui/provider-icon"
import { Tag } from "@opencode-ai/ui/v2/badge-v2"
import { TooltipV2 } from "@opencode-ai/ui/v2/tooltip-v2"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { useTheme } from "@opencode-ai/ui/theme"
import { createMemo, onCleanup, onMount, type Component, For, Show } from "solid-js"
import { useLocal } from "@/context/local"
import { useProviders } from "@/hooks/use-providers"
import { decode64 } from "@/utils/base64"
import { useLanguage } from "@/context/language"
import { ModelTooltip } from "./model-tooltip"

type ModelState = ReturnType<typeof useLocal>["model"]

// HSCode: three primary provider entries for the model selector.
// OpenCode Go, DeepSeek are real providers from the catalog.
// Custom Model opens the custom provider form for self-hosted OpenAI Compatible.
const PRIMARY_PROVIDERS = ["opencode-go", "deepseek"]

const displayModelName = (name: string) => name.replace(/\s+(?:\(free\)|free)$/i, "")

export const DialogSelectModelUnpaidV2: Component<{ model?: ModelState }> = (props) => {
  const local = useLocal()
  const model = props.model ?? local.model
  const dialog = useDialog()
  const theme = useTheme()
  const directory = () => decode64(local.slug())
  const providers = useProviders(directory)
  const language = useLanguage()
  const modelKey = (item: ReturnType<ModelState["list"]>[number]) => `${item.provider.id}:${item.id}`
  const currentKey = createMemo(() => {
    const c = model.current()
    return c ? `${c.provider.id}:${c.id}` : undefined
  })
  const isFree = (item: ReturnType<ModelState["list"]>[number]) =>
    item.provider.id === "opencode" && (!item.cost || item.cost.input === 0)
  const freeModels = createMemo(() => model.list().filter(isFree))

  // Models from primary providers (OpenCode Go + DeepSeek)
  const primaryModels = createMemo(() =>
    model.list().filter((item) => PRIMARY_PROVIDERS.includes(item.provider.id) && !isFree(item)),
  )

  const openProviders = (provider?: string) => {
    void import("./dialog-connect-provider").then((x) => {
      const controller = x.useProviderConnectController()
      controller.select(provider)
      void dialog.show(() => <x.DialogConnectProvider controller={controller} directory={directory} />)
    })
  }

  const openCustomProvider = () => {
    void import("./dialog-custom-provider").then((x) => {
      void dialog.show(() => <x.DialogCustomProvider onBack={() => dialog.close()} />)
    })
  }

  const selectModel = (item: ReturnType<ModelState["list"]>[number]) => {
    model.set({ modelID: item.id, providerID: item.provider.id }, { recent: true })
    dialog.close()
  }

  let listEl: HTMLDivElement | undefined
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return
      if (!listEl) return
      const buttons = Array.from(listEl.querySelectorAll<HTMLButtonElement>("button"))
      if (buttons.length === 0) return
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
      const next =
        index < 0 ? (e.key === "ArrowDown" ? 0 : buttons.length - 1) : index + (e.key === "ArrowDown" ? 1 : -1)
      buttons[(next + buttons.length) % buttons.length]?.focus()
      e.preventDefault()
    }
    document.addEventListener("keydown", handleKeyDown)
    onCleanup(() => document.removeEventListener("keydown", handleKeyDown))
  })

  return (
    <DialogV2
      fit
      containerClass="!h-auto max-h-[calc(100vh_-_16px)] !w-[min(calc(100vw_-_16px),640px)]"
      class="[font-family:var(--v2-font-family-sans)] [&_[data-slot=dialog-header]]:!px-5 [&_[data-slot=dialog-header-title]]:!text-[15px] [&_[data-slot=dialog-header-title]]:!tracking-[-0.13px]"
    >
      <DialogHeader closeLabel={language.t("common.close")}>
        <DialogTitle>{language.t("dialog.model.select.title")}</DialogTitle>
      </DialogHeader>
      <DialogBody class="max-h-[calc(100vh_-_68px)] min-h-0 flex-none gap-0 overflow-y-auto px-2 pb-2">
        <div ref={listEl} class="flex min-h-0 flex-col gap-2">
          {/* Free models section — only show if there are free models */}
          <Show when={freeModels().length > 0}>
            <div data-section="free-models" class="flex w-full flex-col items-start">
              <div class="flex h-8 w-full flex-none select-none flex-row items-center px-3 pb-2">
                <div class="flex h-5 items-center text-[13px] font-[440] leading-5 tracking-[-0.04px] text-v2-text-text-muted [font-family:var(--v2-font-family-sans)] [font-variant-numeric:tabular-nums]">
                  {language.t("dialog.model.unpaid.freeModels.title")}
                </div>
              </div>
              <For each={freeModels()}>
                {(item) => (
                  <TooltipV2
                    class="w-full"
                    placement="right-start"
                    gutter={6}
                    openDelay={0}
                    contentStyle={{ "font-family": "var(--v2-font-family-sans)" }}
                    value={
                      <ModelTooltip
                        model={{ ...item, name: displayModelName(item.name) }}
                        latest={item.latest}
                        free={isFree(item)}
                        v2
                      />
                    }
                  >
                    <button
                      type="button"
                      class="flex w-full scroll-my-3.5 flex-row items-center gap-1.5 rounded-md px-3 py-2 text-left text-[13px] font-[530] leading-5 tracking-[-0.04px] text-v2-text-text-base [font-family:var(--v2-font-family-sans)] [font-variation-settings:'slnt'_0] hover:bg-v2-overlay-simple-overlay-hover focus:bg-v2-overlay-simple-overlay-hover focus:outline-none"
                      onClick={() => selectModel(item)}
                    >
                      <span class="min-w-0 truncate">{displayModelName(item.name)}</span>
                      <Tag class="shrink-0">{language.t("model.tag.free")}</Tag>
                      <Show when={item.latest}>
                        <Tag class="shrink-0">{language.t("model.tag.latest")}</Tag>
                      </Show>
                      <Show when={currentKey() === modelKey(item)}>
                        <Icon name="check" class="ml-auto size-4 shrink-0 text-v2-icon-icon-base" />
                      </Show>
                    </button>
                  </TooltipV2>
                )}
              </For>
            </div>
          </Show>

          {/* HSCode: Primary provider entries — OpenCode Go, DeepSeek, Custom Model */}
          <div class="flex w-full flex-col items-start rounded-lg border-[0.5px] border-v2-border-border-muted bg-v2-background-bg-layer-02 p-2.5 pt-2">
            <div class="flex h-8 w-full select-none items-center px-0.5 pb-2">
              <div class="flex h-5 items-center text-[13px] font-[440] leading-5 tracking-[-0.04px] text-v2-text-text-muted [font-family:var(--v2-font-family-sans)] [font-variant-numeric:tabular-nums]">
                {language.t("dialog.model.unpaid.addMore.title")}
              </div>
            </div>
            <div class="grid w-full grid-cols-1 gap-y-1.5 gap-x-2 sm:grid-cols-2">
              {/* Primary provider cards: OpenCode Go + DeepSeek */}
              <For
                each={[...providers.popular()]
                  .filter((provider) => PRIMARY_PROVIDERS.includes(provider.id))
                  .sort((a, b) => PRIMARY_PROVIDERS.indexOf(a.id) - PRIMARY_PROVIDERS.indexOf(b.id))}
              >
                {(provider) => (
                  <button
                    type="button"
                    data-provider-id={provider.id}
                    class="flex min-h-11 w-full scroll-my-3.5 flex-row items-start gap-2 rounded-md bg-v2-background-bg-base px-3 py-2.5 text-left text-[13px] font-[530] leading-5 tracking-[-0.04px] text-v2-text-text-base [font-family:var(--v2-font-family-sans)] [font-variation-settings:'slnt'_0] hover:bg-v2-background-bg-layer-01 focus:bg-v2-background-bg-layer-01 focus:outline-none"
                    classList={{
                      "border-[0.5px] border-transparent shadow-[var(--v2-elevation-raised)]":
                        theme.mode() !== "dark",
                      "border-[0.5px] border-v2-border-border-strong": theme.mode() === "dark",
                    }}
                    onClick={() => openProviders(provider.id)}
                  >
                    <ProviderIcon id={provider.id} class="mt-0.5 size-4 shrink-0 text-v2-icon-icon-base" />
                    <span class="flex min-w-0 flex-col">
                      <span class="truncate">{provider.name}</span>
                      <Show when={provider.id === "opencode" || provider.id === "opencode-go"}>
                        <span class="truncate font-[440] text-v2-text-text-muted">
                          {language.t(
                            provider.id === "opencode"
                              ? "dialog.provider.opencode.tagline"
                              : "dialog.provider.opencodeGo.tagline",
                          )}
                        </span>
                      </Show>
                      <Show when={provider.id === "deepseek"}>
                        <span class="truncate font-[440] text-v2-text-text-muted">
                          DeepSeek 官方 API
                        </span>
                      </Show>
                    </span>
                  </button>
                )}
              </For>

              {/* HSCode: Custom Model entry — opens self-hosted OpenAI Compatible form */}
              <button
                type="button"
                data-provider-id="custom-model"
                class="flex min-h-11 w-full scroll-my-3.5 flex-row items-start gap-2 rounded-md bg-v2-background-bg-base px-3 py-2.5 text-left text-[13px] font-[530] leading-5 tracking-[-0.04px] text-v2-text-text-base [font-family:var(--v2-font-family-sans)] [font-variation-settings:'slnt'_0] hover:bg-v2-background-bg-layer-01 focus:bg-v2-background-bg-layer-01 focus:outline-none"
                classList={{
                  "border-[0.5px] border-transparent shadow-[var(--v2-elevation-raised)]":
                    theme.mode() !== "dark",
                  "border-[0.5px] border-v2-border-border-strong": theme.mode() === "dark",
                }}
                onClick={openCustomProvider}
              >
                <Icon name="plus" class="mt-0.5 size-4 shrink-0 text-v2-icon-icon-base" />
                <span class="flex min-w-0 flex-col">
                  <span class="truncate">自定义模型</span>
                  <span class="truncate font-[440] text-v2-text-text-muted">
                    连接自己部署的 OpenAI-Compatible 服务
                  </span>
                </span>
              </button>

              {/* Secondary: View more providers (advanced) */}
              <button
                type="button"
                class="col-span-full flex h-8 w-full scroll-my-3.5 items-center justify-start rounded-md px-3 text-left text-[13px] font-[440] leading-5 tracking-[-0.04px] text-v2-text-text-muted [font-family:var(--v2-font-family-sans)] [font-variation-settings:'slnt'_0] hover:bg-v2-overlay-simple-overlay-hover focus:bg-v2-overlay-simple-overlay-hover focus:outline-none"
                onClick={() => openProviders()}
              >
                {language.t("dialog.model.unpaid.viewMoreProviders")}
              </button>
            </div>
          </div>
        </div>
      </DialogBody>
    </DialogV2>
  )
}
