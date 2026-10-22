import { describe, expect, it } from "vitest";
import { hasSensitiveBookmarkQuery, normalizeBookmarkUrl } from "./contract.js";

describe("browser bookmark URL contract", () => {
  it("uses URL canonicalization and retains fragments and meaningful path slashes", () => {
    expect(normalizeBookmarkUrl("HTTP://Example.COM:80/Docs#Intro")).toBe(
      "http://example.com/Docs#Intro",
    );
    expect(normalizeBookmarkUrl("https://example.com/path")).not.toBe(
      normalizeBookmarkUrl("https://example.com/path/"),
    );
  });

  it("rejects non-web schemes and embedded credentials without echoing the input", () => {
    for (const value of [
      "javascript:alert(1)",
      "file:///C:/secret.txt",
      "https://user:password@example.com/",
      "https://@example.com/",
      "https://:@example.com/",
    ]) {
      let error: unknown;
      try {
        normalizeBookmarkUrl(value);
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(TypeError);
      expect((error as Error).message).toMatch(/HTTP or HTTPS/);
      expect((error as Error).message).not.toContain(value);
    }
  });

  it("rejects non-string values with a generic error", () => {
    const privateValue = { token: "must-not-appear" } as unknown as string;
    let error: unknown;
    try {
      normalizeBookmarkUrl(privateValue);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(TypeError);
    expect((error as Error).message).toBe("Bookmark URL must be a string.");
    expect((error as Error).message).not.toContain("must-not-appear");
  });

  it("detects common sensitive query names while leaving ordinary search terms alone", () => {
    for (const key of ["token", "access_token", "api_key", "X-Amz-Signature", "auth"]) {
      expect(hasSensitiveBookmarkQuery(`https://example.com/?${key}=hidden`)).toBe(true);
    }
    expect(hasSensitiveBookmarkQuery("https://example.com/?author=someone&q=public")).toBe(false);
    expect(hasSensitiveBookmarkQuery("not a URL?token=hidden")).toBe(false);
  });
});
