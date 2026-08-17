/**
 * SandpackPreview — live sandboxed preview (and optional code drawer) for the
 * generated project files, powered by @codesandbox/sandpack-react.
 *
 * Layout: the preview is the hero surface. The code editor (when enabled) is a
 * resizable drawer at the bottom — a vertical split — so it never squeezes the
 * preview sideways. The editor's active file is driven by the project store,
 * so clicking a file in the tree opens it here.
 *
 * The Sandpack theme tracks the global dark/light preference.
 * Note: the live preview runs in an iframe with its own document — its
 * background colour is determined by the generated app's own CSS, not by
 * VibeStudio's theme.
 */
import {
  SandpackProvider,
  SandpackPreview as SandpackPreviewPane,
  SandpackCodeEditor,
  useSandpack,
} from "@codesandbox/sandpack-react";
import { useEffect } from "react";
import { useProjectStore } from "../../store/project";
import { useThemeStore } from "../../store/theme";
import { Resizer } from "../Resizer";

interface Props {
  showEditor?: boolean;
  /** Height of the bottom code drawer in px. */
  editorHeight?: number;
  /** Called with a pixel delta while the user drags the drawer resize handle. */
  onEditorResize?: (delta: number) => void;
  /** Hide the preview pane entirely (used by the mobile Code tab). */
  hidePreview?: boolean;
}

/**
 * Bridges the project store's activeFile (driven by the FileTree) into
 * Sandpack's internal store, so clicking a file in the tree opens it in the
 * editor. Sandpack keys are rooted with a leading slash.
 */
function SyncActiveFile(): null {
  const activeFile = useProjectStore((s) => s.activeFile);
  const { sandpack } = useSandpack();

  useEffect(() => {
    if (!activeFile) return;
    const key = activeFile.startsWith("/") ? activeFile : `/${activeFile}`;
    if (key in sandpack.files) sandpack.setActiveFile(key);
  }, [activeFile, sandpack]);

  return null;
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

export function SandpackPreview({
  showEditor = false,
  editorHeight = 320,
  onEditorResize,
  hidePreview = false,
}: Props): React.ReactNode {
  const files = useProjectStore((s) => s.files);
  const isGenerating = useProjectStore((s) => s.generation.isGenerating);
  const isDark = useThemeStore((s) => s.isDark);

  const hasFiles = Object.keys(files).length > 0;

  const sandpackFiles =
    hasFiles
      ? Object.fromEntries(
          Object.entries(files).map(([path, code]) => [
            path.startsWith("/") ? path : `/${path}`,
            { code },
          ]),
        )
      : PLACEHOLDER_FILES;

  return (
    <div className="relative h-full">
      {/* First generation — block the placeholder while the app is built */}
      {isGenerating && !hasFiles && (
        <div className="absolute inset-0 z-10 bg-vs-bg/60 flex items-center justify-center gap-3 text-sm text-vs-text">
          <span className="animate-spin w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full" />
          Generating…
        </div>
      )}

      {/* Regeneration — non-blocking pill so the running app stays usable */}
      {isGenerating && hasFiles && !hidePreview && (
        <div className="absolute top-3 right-3 z-10 pointer-events-none flex items-center gap-2
                        px-3 py-1.5 rounded-full bg-vs-surface/90 border border-vs-border
                        shadow text-xs text-vs-muted">
          <span className="animate-spin w-3 h-3 border border-brand-500 border-t-transparent rounded-full" />
          Regenerating…
        </div>
      )}

      <SandpackProvider
        files={sandpackFiles}
        template="react-ts"
        theme={isDark ? "dark" : "light"}
      >
        <SyncActiveFile />
        {hidePreview ? (
          <div className="h-full">
            <SandpackCodeEditor
              showLineNumbers
              showTabs
              style={{ height: "100%" }}
            />
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex-1 min-h-0">
              <SandpackPreviewPane style={{ height: "100%" }} showNavigator={false} />
            </div>
            {showEditor && (
              <>
                <Resizer direction="vertical" onDrag={onEditorResize ?? (() => {})} />
                <div
                  className="shrink-0 border-t border-vs-border bg-vs-surface"
                  style={{ height: editorHeight }}
                >
                  <SandpackCodeEditor
                    showLineNumbers
                    showTabs
                    style={{ height: "100%" }}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </SandpackProvider>
    </div>
  );
}
