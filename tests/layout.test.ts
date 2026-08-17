/**
 * Tests for src/store/layout.ts
 */
import { describe, it, expect } from "vitest";
import {
  useLayoutStore,
  CHAT_WIDTH_MIN,
  CHAT_WIDTH_MAX,
  CODE_HEIGHT_MIN,
  CODE_HEIGHT_MAX,
} from "../src/store/layout";

describe("layout store", () => {
  it("has sensible defaults within the clamp ranges", () => {
    const { chatWidth, codeHeight } = useLayoutStore.getState();
    expect(chatWidth).toBeGreaterThanOrEqual(CHAT_WIDTH_MIN);
    expect(chatWidth).toBeLessThanOrEqual(CHAT_WIDTH_MAX);
    expect(codeHeight).toBeGreaterThanOrEqual(CODE_HEIGHT_MIN);
    expect(codeHeight).toBeLessThanOrEqual(CODE_HEIGHT_MAX);
  });

  it("persists chat width changes", () => {
    useLayoutStore.getState().setChatWidth(540);
    expect(useLayoutStore.getState().chatWidth).toBe(540);
  });

  it("persists code drawer height changes", () => {
    useLayoutStore.getState().setCodeHeight(440);
    expect(useLayoutStore.getState().codeHeight).toBe(440);
  });
});
