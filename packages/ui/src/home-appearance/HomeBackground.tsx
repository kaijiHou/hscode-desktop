import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { IS_HSCODE_BUILD } from "@zcode/shared";
import { Button } from "@/components/ui/button.js";
import { useZCodeIntl } from "@/i18n/IntlProvider.js";
import {
  normalizeHomeBackground,
  readHomeBackground,
  saveHomeBackground,
  subscribeHomeBackground,
} from "./homeBackgroundStorage.js";

function useHomeBackground() {
  return useSyncExternalStore(subscribeHomeBackground, readHomeBackground, () => null);
}

async function importPhoto(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024) {
    throw new Error("invalid_image");
  }
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 40_000_000 ||
      Math.max(image.naturalWidth, image.naturalHeight) > 16_384
    ) {
      throw new Error("invalid_image");
    }
    const ratio = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("invalid_image");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const result = normalizeHomeBackground(canvas.toDataURL("image/jpeg", 0.85));
    if (!result) throw new Error("invalid_image");
    return result;
  } finally {
    URL.revokeObjectURL(source);
  }
}

export function HomeBackgroundSettings() {
  const { intl } = useZCodeIntl();
  const photo = useHomeBackground();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current += 1;
    },
    [],
  );
  const message = (key: string) =>
    intl.formatMessage({ id: `settings.appearance.background.${key}` });
  const choose = async (file: File) => {
    const current = ++request.current;
    setBusy(true);
    setError(null);
    try {
      const encoded = await importPhoto(file);
      if (current !== request.current) return;
      try {
        saveHomeBackground(encoded);
      } catch {
        setError(message("saveFailed"));
      }
    } catch {
      if (current === request.current) setError(message("invalid"));
    } finally {
      if (current === request.current) setBusy(false);
    }
  };
  if (!IS_HSCODE_BUILD) return null;
  return (
    <section className="space-y-3" data-testid="home-background-settings">
      <div>
        <h3 className="text-ui-lg font-semibold">{message("title")}</h3>
        <p className="mt-1 text-ui-base leading-6 text-foreground-subtle">
          {message("description")}
        </p>
      </div>
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        {photo ? (
          <img
            data-testid="home-background-preview"
            src={photo}
            alt={message("preview")}
            className="h-32 w-full rounded-lg object-cover"
          />
        ) : null}
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            className="sr-only"
            tabIndex={-1}
            accept="image/png,image/jpeg,image/webp"
            aria-label={message("choose")}
            data-testid="home-background-file"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void choose(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            data-testid="home-background-choose"
            onClick={() => input.current?.click()}
          >
            {busy ? message("processing") : message("choose")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={!photo && !busy}
            data-testid="home-background-remove"
            onClick={() => {
              request.current += 1;
              setBusy(false);
              setError(null);
              try {
                saveHomeBackground(null);
              } catch {
                setError(message("saveFailed"));
              }
            }}
          >
            {message("remove")}
          </Button>
        </div>
        {error ? (
          <p role="alert" className="text-ui-base text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function HomeBackgroundLayer() {
  const photo = useHomeBackground();
  if (!IS_HSCODE_BUILD || !photo) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      data-testid="home-background-layer"
    >
      <img src={photo} alt="" className="size-full object-cover opacity-40" />
      <div className="absolute inset-0 bg-background/50" />
    </div>
  );
}
