/**
 * FileTree — displays the generated project files as a nested tree.
 *
 * Clicking a file sets it as the active file in the project store so other
 * components (e.g. a future code editor panel) can display it.
 */
import type { ReactNode } from "react";
import { useProjectStore } from "../../store/project";

interface TreeNode {
  name: string;
  path: string;
  children: Record<string, TreeNode>;
  isFile: boolean;
}

function buildTree(files: Record<string, string>): TreeNode {
  const root: TreeNode = { name: "", path: "", children: {}, isFile: false };

  for (const filePath of Object.keys(files)) {
    const parts = filePath.replace(/^\//, "").split("/");
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          path: parts.slice(0, i + 1).join("/"),
          children: {},
          isFile: isLast,
        };
      }
      current = current.children[part];
    }
  }

  return root;
}

interface NodeProps {
  node: TreeNode;
  depth: number;
  activeFile: string | null;
  onSelect: (path: string) => void;
}

function TreeNodeView({ node, depth, activeFile, onSelect }: NodeProps): ReactNode {
  const sortedChildren = Object.values(node.children).sort((a, b) => {
    if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  const isActive = node.isFile && activeFile === node.path;

  return (
    <div>
      {node.name && (
        <button
          onClick={() => node.isFile && onSelect(node.path)}
          className={[
            "w-full text-left flex items-center gap-1.5 px-2 py-1 text-xs rounded-md",
            "transition-colors",
            isActive
              ? "bg-brand-500/10 text-brand-400 font-medium"
              : node.isFile
                ? "text-vs-muted hover:bg-vs-raised hover:text-vs-text"
                : "font-medium text-vs-text hover:bg-vs-raised",
            node.isFile ? "cursor-pointer" : "cursor-default",
          ].join(" ")}
          style={{ paddingLeft: `${8 + depth * 12}px` }}
        >
          <span className="shrink-0 text-vs-faint">
            {node.isFile ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            )}
          </span>
          <span className="truncate">{node.name}</span>
        </button>
      )}
      {!node.isFile &&
        sortedChildren.map((child) => (
          <TreeNodeView
            key={child.path}
            node={child}
            depth={depth + (node.name ? 1 : 0)}
            activeFile={activeFile}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

interface Props {
  /** Called with the selected path after it is set as active (e.g. to open the editor). */
  onSelect?: (path: string) => void;
}

export function FileTree({ onSelect }: Props): ReactNode {
  const files = useProjectStore((s) => s.files);
  const activeFile = useProjectStore((s) => s.activeFile);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);

  const tree = buildTree(files);
  const hasFiles = Object.keys(files).length > 0;

  const handleSelect = (path: string): void => {
    setActiveFile(path);
    onSelect?.(path);
  };

  return (
    <div className="h-full bg-vs-surface overflow-y-auto">
      <div className="px-3 py-2 text-xs font-semibold text-vs-muted uppercase tracking-wider border-b border-vs-border">
        Files
      </div>

      {hasFiles ? (
        <TreeNodeView
          node={tree}
          depth={0}
          activeFile={activeFile}
          onSelect={handleSelect}
        />
      ) : (
        <div className="px-3 py-4 text-xs text-vs-faint text-center">
          No files yet.
          <br />
          Generate your first app.
        </div>
      )}
    </div>
  );
}
