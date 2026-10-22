import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BookmarkPort, BookmarkSnapshot } from "@zcode/shared/browser-bookmarks";
import {
  BookmarkService,
  BookmarkServiceError,
  type BookmarkFileSystem,
} from "../src/main/bookmarks/bookmarkService.js";

let testDirectory: string;
let filePath: string;

beforeEach(async () => {
  testDirectory = await fs.mkdtemp(join(tmpdir(), "browser-bookmarks-"));
  filePath = join(testDirectory, "bookmarks-v1.json");
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(testDirectory, { recursive: true, force: true });
});

function fileSystem(overrides: Partial<BookmarkFileSystem> = {}): BookmarkFileSystem {
  return {
    readFile: (path) => fs.readFile(path, "utf8"),
    mkdir: async (path) => {
      await fs.mkdir(path, { recursive: true });
    },
    writeFile: (path, contents) => fs.writeFile(path, contents, { encoding: "utf8", flag: "wx" }),
    rename: (oldPath, newPath) => fs.rename(oldPath, newPath),
    unlink: (path) => fs.unlink(path),
    ...overrides,
  };
}

function codedError(code: string): NodeJS.ErrnoException {
  const error = new Error("private low-level failure") as NodeJS.ErrnoException;
  error.code = code;
  return error;
}

async function expectServiceError(
  promise: Promise<unknown>,
  code: ConstructorParameters<typeof BookmarkServiceError>[0],
  forbiddenText?: string,
) {
  const error = await promise.then(
    () => undefined,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(BookmarkServiceError);
  expect(error).toMatchObject({ code });
  if (forbiddenText && error instanceof Error) {
    expect(error.message).not.toContain(forbiddenText);
  }
}

describe("BookmarkService", () => {
  it("persists CRUD changes and restores them after restart without consent fields", async () => {
    const service = new BookmarkService(filePath);
    const created = await service.save({
      title: "Private link",
      url: "https://example.com/?access_token=secret-value#settings",
      allowSensitiveUrl: true,
    });
    const updated = await service.save({
      id: created.bookmarks[0]!.id,
      title: "Updated link",
      url: "https://example.com/new#settings",
    });
    expect(updated.revision).toBe(2);
    expect(updated.bookmarks[0]).toMatchObject({
      title: "Updated link",
      url: "https://example.com/new#settings",
    });

    const persisted = JSON.parse(await fs.readFile(filePath, "utf8")) as Record<string, unknown>;
    expect(persisted).toMatchObject({ version: 1, revision: 2 });
    expect(persisted).not.toHaveProperty("allowSensitiveUrl");
    expect(persisted.bookmarks).toEqual([
      expect.not.objectContaining({ allowSensitiveUrl: expect.anything() }),
    ]);

    const restarted = new BookmarkService(filePath);
    expect(await restarted.list()).toEqual(updated);
    expect((await restarted.remove(created.bookmarks[0]!.id)).bookmarks).toEqual([]);
  });

  it("keeps the original title on a canonical duplicate and rejects duplicate edits", async () => {
    const service = new BookmarkService(filePath);
    const original = await service.save({ title: "Original", url: "HTTP://Example.COM:80/path" });
    const duplicate = await service.save({
      title: "Unexpected replacement",
      url: "http://example.com/path",
    });
    expect(duplicate).toEqual(original);
    expect(duplicate.bookmarks).toHaveLength(1);
    expect(duplicate.bookmarks[0]!.title).toBe("Original");

    const other = await service.save({ title: "Other", url: "https://example.net/" });
    await expectServiceError(
      service.save({
        id: other.bookmarks[1]!.id,
        title: "Collision",
        url: "http://example.com/path",
      }),
      "duplicate-url",
    );
    expect((await service.list()).revision).toBe(2);
  });

  it("serializes commands from multiple windows and publishes only committed revisions", async () => {
    const service = new BookmarkService(filePath);
    const firstWindow: BookmarkPort = service;
    const secondWindow: BookmarkPort = service;
    const changes: BookmarkSnapshot[] = [];
    const unsubscribe = firstWindow.onChanged((snapshot) => changes.push(snapshot));

    const [first, second] = await Promise.all([
      firstWindow.save({ title: "First", url: "https://example.com/" }),
      secondWindow.save({ title: "Duplicate", url: "https://EXAMPLE.com:443/" }),
    ]);
    const third = await secondWindow.save({ title: "Second", url: "https://example.org/" });
    const removed = await firstWindow.remove(first.bookmarks[0]!.id);

    expect([first.revision, second.revision, third.revision, removed.revision]).toEqual([
      1, 1, 2, 3,
    ]);
    expect(changes.map((snapshot) => snapshot.revision)).toEqual([1, 2, 3]);
    expect((await secondWindow.list()).revision).toBe(3);
    unsubscribe();
    await secondWindow.save({ title: "After unsubscribe", url: "https://example.dev/" });
    expect(changes).toHaveLength(3);
  });

  it("requires explicit confirmation for sensitive queries and rejects unsafe URLs", async () => {
    const service = new BookmarkService(filePath);
    const secretUrl = "https://example.com/?token=do-not-leak";
    await expectServiceError(
      service.save({ title: "Needs consent", url: secretUrl }),
      "sensitive-url-confirmation-required",
    );
    expect(
      (await service.save({ title: "Confirmed", url: secretUrl, allowSensitiveUrl: true }))
        .bookmarks,
    ).toHaveLength(1);

    for (const url of [
      "javascript:alert(1)",
      "file:///C:/private",
      "https://user:pass@example.com/",
    ]) {
      await expectServiceError(service.save({ title: "Unsafe", url }), "invalid-url");
    }
  });

  it("keeps the old file and recovers the command queue after serialization fails", async () => {
    const setup = new BookmarkService(filePath);
    const before = await setup.save({ title: "Existing", url: "https://example.com/" });
    const originalFile = await fs.readFile(filePath, "utf8");
    const service = new BookmarkService(filePath);
    vi.spyOn(JSON, "stringify").mockImplementationOnce(() => {
      throw new Error("serialization failure");
    });

    await expectServiceError(
      service.save({ title: "Failed", url: "https://example.org/" }),
      "storage-unavailable",
      "serialization failure",
    );
    expect(await fs.readFile(filePath, "utf8")).toBe(originalFile);
    expect(await service.list()).toEqual(before);

    const recovered = await service.save({ title: "Recovered", url: "https://example.net/" });
    expect(recovered.revision).toBe(2);
    expect(recovered.bookmarks.map((bookmark) => bookmark.title)).toEqual([
      "Existing",
      "Recovered",
    ]);
    expect(await new BookmarkService(filePath).list()).toEqual(recovered);
  });

  it("enforces Main input and stored-data length limits", async () => {
    const service = new BookmarkService(filePath);
    await expectServiceError(
      service.save({ title: "x".repeat(201), url: "https://example.com/" }),
      "invalid-bookmark",
    );
    await expectServiceError(
      service.save({ title: "Long URL", url: `https://example.com/${"x".repeat(8175)}` }),
      "invalid-bookmark",
    );
    await expectServiceError(
      service.save({ id: "i".repeat(129), title: "Long ID", url: "https://example.com/" }),
      "invalid-bookmark",
    );
    await expectServiceError(service.remove("i".repeat(129)), "invalid-bookmark");

    const validBookmark = {
      id: "bookmark-1",
      title: "Valid",
      url: "https://example.com/",
      createdAt: 1,
      updatedAt: 1,
    };
    const invalidSnapshots = [
      { version: 1, revision: 1, bookmarks: [{ ...validBookmark, title: "x".repeat(201) }] },
      {
        version: 1,
        revision: 1,
        bookmarks: [{ ...validBookmark, url: `https://example.com/${"x".repeat(8175)}` }],
      },
      { version: 1, revision: 1, bookmarks: [{ ...validBookmark, id: "i".repeat(129) }] },
      {
        version: 1,
        revision: 2,
        bookmarks: [validBookmark, { ...validBookmark, id: "bookmark-2" }],
      },
      {
        version: 1,
        revision: 2,
        bookmarks: [
          validBookmark,
          { ...validBookmark, id: "bookmark-2", url: "https://EXAMPLE.com:443/" },
        ],
      },
    ];
    for (const invalidSnapshot of invalidSnapshots) {
      const contents = JSON.stringify(invalidSnapshot);
      await fs.writeFile(filePath, contents, "utf8");
      await expectServiceError(new BookmarkService(filePath).list(), "invalid-storage");
      expect(await fs.readFile(filePath, "utf8")).toBe(contents);
    }
  });

  it("accepts title, URL, and ID values exactly at their configured limits", async () => {
    const title = "t".repeat(200);
    const url = `https://example.com/${"x".repeat(8192 - "https://example.com/".length)}`;
    const maxId = "i".repeat(128);
    const service = new BookmarkService(filePath);

    const created = await service.save({ title, url });
    expect(created.bookmarks[0]).toMatchObject({ title, url });
    await expectServiceError(
      service.save({ id: maxId, title, url: "https://example.net/" }),
      "bookmark-not-found",
    );

    const atLimit = {
      version: 1,
      revision: 1,
      bookmarks: [{ id: maxId, title, url, createdAt: 1, updatedAt: 1 }],
    };
    await fs.writeFile(filePath, JSON.stringify(atLimit), "utf8");
    expect(await new BookmarkService(filePath).list()).toEqual({
      revision: 1,
      bookmarks: [{ id: maxId, title, url, createdAt: 1, updatedAt: 1 }],
    });
  });

  it("preserves corrupt or structurally invalid files instead of replacing them", async () => {
    for (const contents of [
      "{truncated",
      JSON.stringify({ version: 2, revision: 0, bookmarks: [] }),
    ]) {
      await fs.writeFile(filePath, contents, "utf8");
      const service = new BookmarkService(filePath);
      await expectServiceError(service.list(), "invalid-storage");
      await expectServiceError(
        service.save({ title: "Do not overwrite", url: "https://example.com/" }),
        "invalid-storage",
      );
      expect(await fs.readFile(filePath, "utf8")).toBe(contents);
    }
  });

  it("sanitizes EACCES errors and leaves state unchanged after write and rename failures", async () => {
    const denied = new BookmarkService(
      filePath,
      fileSystem({
        readFile: async () => {
          throw codedError("EACCES");
        },
      }),
    );
    await expectServiceError(denied.list(), "storage-unavailable", "private low-level failure");

    const initial = new BookmarkService(filePath);
    const before = await initial.save({ title: "Existing", url: "https://example.com/" });
    const originalFile = await fs.readFile(filePath, "utf8");
    const writeFailure = new BookmarkService(
      filePath,
      fileSystem({
        writeFile: async () => {
          throw codedError("EACCES");
        },
      }),
    );
    const sensitiveValue = "https://example.org/?token=private-value";
    const failedWriteChanges: BookmarkSnapshot[] = [];
    writeFailure.onChanged((snapshot) => failedWriteChanges.push(snapshot));
    await expectServiceError(
      writeFailure.save({ title: "Failed write", url: sensitiveValue, allowSensitiveUrl: true }),
      "storage-unavailable",
      "private-value",
    );
    expect(await fs.readFile(filePath, "utf8")).toBe(originalFile);
    expect(await writeFailure.list()).toEqual(before);
    expect(failedWriteChanges).toEqual([]);

    const renameFailure = new BookmarkService(
      filePath,
      fileSystem({
        rename: async () => {
          throw codedError("EPERM");
        },
      }),
    );
    await expectServiceError(
      renameFailure.save({ title: "Failed rename", url: "https://example.net/" }),
      "storage-unavailable",
    );
    expect(await fs.readFile(filePath, "utf8")).toBe(originalFile);
    expect((await fs.readdir(testDirectory)).filter((entry) => entry.endsWith(".tmp"))).toEqual([]);
  });
});
