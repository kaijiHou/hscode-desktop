import { useEffect, useState } from "react";
import type { BookmarkInput, BookmarkSnapshot } from "@zcode/shared/browser-bookmarks";
import { usePlatform } from "@/hooks/usePlatform.js";
import { acceptBookmarkSnapshot } from "./bookmarkProjection.js";

export function useBookmarks() {
  const port = usePlatform().bookmarks;
  const [snapshot, setSnapshot] = useState<BookmarkSnapshot>({ revision: -1, bookmarks: [] });
  const [pending, setPending] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    const receive = (next: BookmarkSnapshot) => {
      if (active) setSnapshot((current) => acceptBookmarkSnapshot(current, next));
    };
    if (!port) {
      setPending(false);
      return;
    }
    const unsubscribe = port.onChanged(receive);
    void port
      .list()
      .then(receive)
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setPending(false);
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [port]);

  const mutate = async (operation: () => Promise<BookmarkSnapshot>) => {
    setPending(true);
    setError(false);
    try {
      const next = await operation();
      setSnapshot((current) => acceptBookmarkSnapshot(current, next));
      return true;
    } catch {
      // 不透传 IPC/文件错误，避免敏感 URL 或本机路径进入 UI 日志。
      setError(true);
      return false;
    } finally {
      setPending(false);
    }
  };
  return {
    supported: Boolean(port),
    snapshot,
    pending,
    error,
    save: (input: BookmarkInput) => mutate(() => port!.save(input)),
    remove: (id: string) => mutate(() => port!.remove(id)),
  };
}
