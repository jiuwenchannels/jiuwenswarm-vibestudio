/**
 * FileTree — displays the generated project files as a nested, collapsible
 * tree. Clicking a file selects it (the code editor opens/switches to it);
 * folders collapse/expand with a chevron.
 */
import { useEffect, useState, type ReactNode } from "react";
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
  expanded: Set<string>;
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
}

function TreeNodeView({
  node,
  depth,
  activeFile,
  expanded,
  onSelect,
  onToggle,
}: NodeProps): ReactNode {
  const sortedChildren = Object.values(node.children).sort((a, b) => {
    if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  const isActive = node.isFile && activeFile === node.path;
  const isCollapsed = !node.isFile && node.name !== "" && !expanded.has(node.path);

  return (
    <div>
      {node.name && (
        <button
          onClick={() => {
            if (node.isFile) onSelect(node.path);
            else onToggle(node.path);
          }}
          className={[
            "w-full text-left flex items-center gap-1 px-2 py-1 text-xs rounded-md",
            "transition-colors",
            isActive
              ? "bg-brand-500/10 text-brand-400 font-medium"
              : node.isFile
                ? "text-vs-muted hover:bg-vs-raised hover:text-vs-text"
                : "font-medium text-vs-text hover:bg-vs-raised",
            node.isFile ? "cursor-pointer" : "cursor-pointer",
          ].join(" ")}
          style={{ paddingLeft: `${8 + depth * 12}px` }}
          title={node.path}
        >
          {!node.isFile ? (
            <span className={`shrink-0 text-vs-faint transition-transform ${isCollapsed ? "" : "rotate-90"}`}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </span>
          ) : (
            <span className="shrink-0 w-[11px]" />
          )}
          <span className="shrink-0 text-vs-faint">
            {node.isFile ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            )}
          </span>
          <span className="truncate">{node.name}</span>
        </button>
      )}
      {!node.isFile &&
        !isCollapsed &&
        sortedChildren.map((child) => (
          <TreeNodeView
            key={child.path}
            node={child}
            depth={depth + (node.name ? 1 : 0)}
            activeFile={activeFile}
            expanded={expanded}
            onSelect={onSelect}
            onToggle={onToggle}
          />
        ))}
    </div>
  );
}

interface Props {
  /** Called with the selected path after it is set as active. */
  onSelect?: (path: string) => void;
}

export function FileTree({ onSelect }: Props): ReactNode {
  const files = useProjectStore((s) => s.files);
  const activeFile = useProjectStore((s) => s.activeFile);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);
  // Folders are collapsed by default — an empty set means "nothing expanded".
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const tree = buildTree(files);
  const hasFiles = Object.keys(files).length > 0;

  // Keep the active file's ancestor folders expanded so it stays visible.
  useEffect(() => {
    if (!activeFile) return;
    const parts = activeFile.split("/");
    const ancestors: string[] = [];
    let acc = "";
    for (let i = 0; i < parts.length - 1; i++) {
      acc = acc ? `${acc}/${parts[i]}` : parts[i];
      ancestors.push(acc);
    }
    if (ancestors.length === 0) return;
    setExpanded((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const a of ancestors) {
        if (!next.has(a)) {
          next.add(a);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [activeFile]);

  const handleSelect = (path: string): void => {
    setActiveFile(path);
    onSelect?.(path);
  };

  const handleToggle = (path: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <div className="h-full bg-vs-surface overflow-y-auto py-1">
      {hasFiles ? (
        <TreeNodeView
          node={tree}
          depth={0}
          activeFile={activeFile}
          expanded={expanded}
          onSelect={handleSelect}
          onToggle={handleToggle}
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
