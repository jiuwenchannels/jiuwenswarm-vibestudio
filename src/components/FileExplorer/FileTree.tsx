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
            "w-full text-left flex items-center gap-1.5 px-2 py-1 text-xs rounded",
            "hover:bg-gray-800 transition-colors",
            isActive ? "bg-gray-700 text-brand-400" : "text-gray-400",
            node.isFile ? "cursor-pointer" : "cursor-default font-medium text-gray-300",
          ].join(" ")}
          style={{ paddingLeft: `${8 + depth * 12}px` }}
        >
          <span>{node.isFile ? "📄" : "📁"}</span>
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

export function FileTree(): ReactNode {
  const files = useProjectStore((s) => s.files);
  const activeFile = useProjectStore((s) => s.activeFile);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);

  const tree = buildTree(files);
  const hasFiles = Object.keys(files).length > 0;

  return (
    <div className="h-full bg-gray-900 border-r border-gray-800 overflow-y-auto">
      <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-800">
        Files
      </div>

      {hasFiles ? (
        <TreeNodeView
          node={tree}
          depth={0}
          activeFile={activeFile}
          onSelect={setActiveFile}
        />
      ) : (
        <div className="px-3 py-4 text-xs text-gray-600 text-center">
          No files yet.
          <br />
          Generate your first app.
        </div>
      )}
    </div>
  );
}
