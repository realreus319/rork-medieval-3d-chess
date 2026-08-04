import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, UI_COPY, resolveLocale } from "./i18n";

const requiredText = [
  "documentTitle",
  "description",
  "brand",
  "brandSubtitle",
  "switchLanguage",
  "settings",
  "chooseSide",
  "difficultyLabel",
  "rulesTitle",
  "rulesSummary",
  "ledgerTitle",
  "emptyLedger",
  "capturedTitle",
  "none",
  "hint",
  "victoryDescription",
  "rematch",
] as const;

describe("Xiangqi interface locales", () => {
  it("uses Simplified Chinese when no valid preference exists", () => {
    expect(DEFAULT_LOCALE).toBe("zh-CN");
    expect(resolveLocale(null)).toBe("zh-CN");
    expect(resolveLocale("fr-FR")).toBe("zh-CN");
  });

  it("accepts both supported locale values", () => {
    expect(resolveLocale("zh-CN")).toBe("zh-CN");
    expect(resolveLocale("en-US")).toBe("en-US");
  });

  it.each(["zh-CN", "en-US"] as const)("provides complete visible copy for %s", (locale) => {
    const copy = UI_COPY[locale];
    for (const key of requiredText) expect(copy[key]).toBeTruthy();
    expect(copy.colorNames.red).toBeTruthy();
    expect(copy.colorNames.black).toBeTruthy();
    expect(copy.toolbar.undo).toBeTruthy();
    expect(copy.modes.ai).toBeTruthy();
    expect(copy.modes.local).toBeTruthy();
    expect(copy.sides.red).toBeTruthy();
    expect(copy.sides.black).toBeTruthy();
    expect(copy.difficulties[1]).toBeTruthy();
    expect(copy.difficulties[2]).toBeTruthy();
    expect(copy.difficulties[3]).toBeTruthy();
  });
});
