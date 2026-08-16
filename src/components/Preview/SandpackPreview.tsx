/**
 * SandpackPreview — renders the generated project files in a live sandboxed
 * browser environment using @codesandbox/sandpack-react.
 *
 * The preview automatically re-renders whenever the project store's `files`
 * map changes (i.e., when the agent finishes a generation turn).
 */
import { Sandpack } from "@codesandbox/sandpack-react";
import { useProjectStore } from "../../store/project";

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

export function SandpackPreview(): React.ReactNode {
  const files = useProjectStore((s) => s.files);
  const isGenerating = useProjectStore((s) => s.generation.isGenerating);

  // Convert the project file map to Sandpack's expected shape.
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
        <div className="absolute inset-0 z-10 bg-gray-950/60 flex items-center justify-center gap-3 text-sm text-gray-300">
          <span className="animate-spin w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full" />
          Generating…
        </div>
      )}

      <Sandpack
        files={sandpackFiles}
        template="react-ts"
        theme="dark"
        options={{
          showNavigator: false,
          showLineNumbers: true,
          editorHeight: "100%",
          showPreview: true,
        }}
        style={{ height: "100%" }}
      />
    </div>
  );
}
