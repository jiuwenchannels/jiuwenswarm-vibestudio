/**
 * Layout store — persisted workspace sizing preferences.
 *
 * Sizes survive page reloads so the user's preferred layout sticks around.
 * Chat width and the code drawer height are clamped to keep every surface
 * usable.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const CHAT_WIDTH_MIN = 320;
export const CHAT_WIDTH_MAX = 760;
export const CODE_HEIGHT_MIN = 200;
export const CODE_HEIGHT_MAX = 560;

interface LayoutState {
  /** Width of the chat column in px. */
  chatWidth: number;
  /** Height of the code drawer in px. */
  codeHeight: number;
  setChatWidth: (width: number) => void;
  setCodeHeight: (height: number) => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      chatWidth: 420,
      codeHeight: 320,
      setChatWidth: (width) => set({ chatWidth: width }),
      setCodeHeight: (height) => set({ codeHeight: height }),
    }),
    { name: "vs-layout" },
  ),
);
