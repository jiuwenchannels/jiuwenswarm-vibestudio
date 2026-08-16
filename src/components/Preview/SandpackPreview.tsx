/**
 * SandpackPreview — live sandboxed preview (and optional code editor) for the
 * generated project files, powered by @codesandbox/sandpack-react.
 *
 * showEditor = false (default / Base44-style):
 *   Full-width live preview only — no code editor visible.
 *
 * showEditor = true (when user clicks "Code"):
 *   Code editor on the left + live preview on the right, Sandpack-native split.
 *
 * The Sandpack theme tracks the global dark/light preference.
 * Note: the live preview runs in an iframe with its own document — its
 * background colour is determined by the generated app's own CSS, not by
 * VibeStudio's theme.
 */
import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview as SandpackPreviewPane,
  SandpackCodeEditor,
} from "@codesandbox/sandpack-react";
import { useProjectStore } from "../../store/project";
import { useThemeStore } from "../../store/theme";

interface Props {
  showEditor?: boolean;
}

/** Minimal placeholder shown before the first generation. */
const PLACEHOLDER_FILES = {
  "/App.tsx": {
    code: `export default function App() {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      fontFamily: "sans-serif",
      color: "#6b7280",
      flexDirection: "column",
      gap: "1rem",
    }}>
      <p style={{ fontSize: "2rem" }}>✨</p>
      <p>Your app will appear here.</p>
      <p style={{ fontSize: "0.875rem" }}>
        Describe what you want to build in the chat panel.
      </p>
    </div>
  );
}`,
  },
};

export function SandpackPreview({ showEditor = false }: Props): React.ReactNode {
  const files = useProjectStore((s) => s.files);
  const isGenerating = useProjectStore((s) => s.generation.isGenerating);
  const isDark = useThemeStore((s) => s.isDark);

  const sandpackFiles =
    Object.keys(files).length > 0
      ? Object.fromEntries(
          Object.entries(files).map(([path, code]) => [
            path.startsWith("/") ? path : `/${path}`,
            { code },
          ]),
        )
      : PLACEHOLDER_FILES;

  return (
    <div className="relative h-full">
      {/* Overlay while generating */}
      {isGenerating && (
        <div className="absolute inset-0 z-10 bg-vs-bg/60 flex items-center justify-center gap-3 text-sm text-vs-text">
          <span className="animate-spin w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full" />
          Generating…
        </div>
      )}

      <SandpackProvider
        files={sandpackFiles}
        template="react-ts"
        theme={isDark ? "dark" : "light"}
      >
        <SandpackLayout style={{ height: "100%", borderRadius: 0, border: "none" }}>
          {showEditor && (
            <SandpackCodeEditor
              showLineNumbers
              showTabs
              style={{ height: "100%", flex: 1 }}
            />
          )}
          <SandpackPreviewPane
            style={{ height: "100%", flex: showEditor ? 1 : 1 }}
            showNavigator={false}
          />
        </SandpackLayout>
      </SandpackProvider>
    </div>
  );
}
