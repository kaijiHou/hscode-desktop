import { useState } from "react";
import { Bookmark as BookmarkIcon, Globe, Pencil, Plus, Star, Trash2 } from "lucide-react";
import {
  hasSensitiveBookmarkQuery,
  normalizeBookmarkUrl,
  type Bookmark,
  type BookmarkInput,
} from "@zcode/shared/browser-bookmarks";
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import { Checkbox } from "@/components/ui/checkbox.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.js";
import { useZCodeIntl } from "@/i18n/IntlProvider.js";
import { bookmarkAtUrl, filterBookmarks } from "./bookmarkProjection.js";
import { useBookmarks } from "./useBookmarks.js";

export function BrowserBookmarksControl({
  currentUrl,
  title,
  onOpenCurrent,
  onOpenNew,
}: {
  currentUrl: string;
  title: string;
  onOpenCurrent: (url: string) => void;
  onOpenNew?: (url: string) => void;
}) {
  const bookmarks = useBookmarks();
  const { intl } = useZCodeIntl();
  const t = (key: string) => intl.formatMessage({ id: `browser.bookmarks.${key}` });
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<BookmarkInput | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const current = bookmarkAtUrl(bookmarks.snapshot, currentUrl);
  let validCurrentUrl: string | null = null;
  try {
    validCurrentUrl = normalizeBookmarkUrl(currentUrl);
  } catch {
    /* 空白/内联页面不可收藏。 */
  }
  const beginEdit = (input: BookmarkInput) => {
    setEditor({ id: input.id, title: input.title, url: input.url, allowSensitiveUrl: false });
    setValidationError(null);
    setPendingDelete(null);
  };
  const beginCurrent = async () => {
    if (!validCurrentUrl) return;
    if (current) {
      await bookmarks.remove(current.id);
      return;
    }
    const input = {
      title: title.trim() || new URL(validCurrentUrl).hostname,
      url: validCurrentUrl,
    };
    if (hasSensitiveBookmarkQuery(validCurrentUrl)) {
      beginEdit(input);
      setOpen(true);
      return;
    }
    if (!(await bookmarks.save(input))) setOpen(true);
  };
  const openBookmark = (bookmark: Bookmark, newTab: boolean) => {
    try {
      const url = normalizeBookmarkUrl(bookmark.url);
      (newTab ? onOpenNew : onOpenCurrent)?.(url);
      setOpen(false);
    } catch {
      setValidationError("invalidUrl");
    }
  };
  const save = async () => {
    if (!editor) return;
    try {
      normalizeBookmarkUrl(editor.url);
    } catch {
      setValidationError("invalidUrl");
      return;
    }
    if (hasSensitiveBookmarkQuery(editor.url) && !editor.allowSensitiveUrl) {
      setValidationError("sensitiveConfirmation");
      return;
    }
    if (await bookmarks.save(editor)) {
      setEditor(null);
      setValidationError(null);
    }
  };
  if (!bookmarks.supported) return null;
  const sensitive = editor ? hasSensitiveBookmarkQuery(editor.url) : false;
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-md"
        disabled={bookmarks.pending || !validCurrentUrl}
        aria-label={t(current ? "remove" : "add")}
        title={t(current ? "remove" : "add")}
        aria-pressed={Boolean(current)}
        data-testid="browser-bookmark-star"
        onClick={() => void beginCurrent()}
      >
        <Star className={current ? "size-4 fill-current text-brand" : "size-4"} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-md"
        aria-label={t("manage")}
        title={t("manage")}
        data-testid="browser-bookmark-manager"
        onClick={() => setOpen(true)}
      >
        <BookmarkIcon className="size-4" />
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) {
            setEditor(null);
            setPendingDelete(null);
            setValidationError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg" onClick={(event) => event.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription className="sr-only">{t("manage")}</DialogDescription>
          </DialogHeader>
          {bookmarks.error || validationError ? (
            <p role="alert" className="text-ui-sm text-destructive">
              {t(validationError ?? "error")}
            </p>
          ) : null}
          {editor ? (
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void save();
              }}
            >
              <label className="flex flex-col gap-1 text-ui-sm">
                {t("name")}
                <Input
                  autoFocus
                  value={editor.title}
                  maxLength={200}
                  required
                  data-testid="browser-bookmark-title"
                  onChange={(event) => setEditor({ ...editor, title: event.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1 text-ui-sm">
                {t("url")}
                <Input
                  value={editor.url}
                  required
                  spellCheck={false}
                  maxLength={8192}
                  data-testid="browser-bookmark-url"
                  onChange={(event) => {
                    setEditor({ ...editor, url: event.target.value, allowSensitiveUrl: false });
                    setValidationError(null);
                  }}
                />
              </label>
              {sensitive ? (
                <div className="flex flex-col gap-2 rounded-lg bg-warning-surface p-3 text-ui-sm text-warning-surface-foreground">
                  <p>{t("sensitiveWarning")}</p>
                  <label className="flex items-start gap-2">
                    <Checkbox
                      checked={editor.allowSensitiveUrl === true}
                      onCheckedChange={(checked) =>
                        setEditor({ ...editor, allowSensitiveUrl: checked === true })
                      }
                    />
                    {t("allowSensitive")}
                  </label>
                </div>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditor(null)}>
                  {t("cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={bookmarks.pending}
                  data-testid="browser-bookmark-save"
                >
                  {t("save")}
                </Button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Input
                  aria-label={t("search")}
                  placeholder={t("search")}
                  value={query}
                  data-testid="browser-bookmark-search"
                  onChange={(event) => setQuery(event.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => beginEdit({ title: "", url: "https://" })}
                >
                  <Plus className="size-4" />
                  {t("addCustom")}
                </Button>
              </div>
              <ul className="max-h-80 min-h-0 space-y-1 overflow-y-auto" aria-label={t("title")}>
                {filterBookmarks(bookmarks.snapshot.bookmarks, query).map((bookmark) => (
                  <li key={bookmark.id} className="min-w-0 rounded-lg p-2 hover:bg-hover">
                    <div className="flex items-center gap-2">
                      <Globe className="size-4 shrink-0 text-foreground-subtle" />
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          className="block max-w-full truncate text-left text-ui-base hover:underline"
                          onClick={() => openBookmark(bookmark, false)}
                        >
                          {bookmark.title}
                        </button>
                        <p className="truncate text-ui-sm text-foreground-subtle">{bookmark.url}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("edit")}
                        disabled={bookmarks.pending}
                        onClick={() => beginEdit(bookmark)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("delete")}
                        disabled={bookmarks.pending}
                        onClick={() => setPendingDelete(bookmark.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    {pendingDelete === bookmark.id ? (
                      <div
                        role="group"
                        aria-label={t("confirmDelete")}
                        className="mt-2 flex flex-wrap items-center gap-2 text-ui-sm"
                      >
                        <span>{t("confirmDelete")}</span>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={bookmarks.pending}
                          onClick={() => {
                            void bookmarks.remove(bookmark.id).then((ok) => {
                              if (ok) setPendingDelete(null);
                            });
                          }}
                        >
                          {t("delete")}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setPendingDelete(null)}
                        >
                          {t("cancel")}
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          onClick={() => openBookmark(bookmark, false)}
                        >
                          {t("openCurrent")}
                        </Button>
                        {onOpenNew ? (
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            onClick={() => openBookmark(bookmark, true)}
                          >
                            {t("openNew")}
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </li>
                ))}
                {bookmarks.snapshot.bookmarks.length === 0 ? (
                  <li className="p-3 text-ui-sm text-foreground-subtle">{t("empty")}</li>
                ) : null}
              </ul>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
