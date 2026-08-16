/**
 * Export utilities for VibeStudio projects.
 *
 * downloadProjectZip — packages all generated files into a ZIP and triggers
 * a browser download without any server round-trip.
 *
 * Uses `fflate` (a tiny, tree-shakeable ZIP library that works in the browser).
 */
import { strToU8, zip } from "fflate";

/**
 * Build a ZIP archive from the project file map and trigger a browser download.
 *
 * @param files   Record of { path → source } as stored in the project store.
 * @param name    Project name — used as the downloaded file name.
 */
export function downloadProjectZip(
  files: Record<string, string>,
  name: string,
): void {
  if (Object.keys(files).length === 0) return;

  // Build fflate's input structure: { "relative/path": Uint8Array }
  const zipInput: Record<string, Uint8Array> = {};
  for (const [rawPath, content] of Object.entries(files)) {
    // Strip leading slash so zip root is clean.
    const zipPath = rawPath.replace(/^\/+/, "");
    zipInput[zipPath] = strToU8(content);
  }

  zip(zipInput, { level: 6 }, (err, data) => {
    if (err) {
      console.error("[VibeStudio] ZIP export failed:", err);
      return;
    }

    const blob = new Blob([data], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizeFilename(name)}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

/**
 * Export the chat conversation as a Markdown file and trigger a browser download.
 *
 * Format:
 *   # Project name
 *   Exported: <ISO timestamp>
 *
 *   **You:** message…
 *
 *   **Agent:** message…
 *
 * Status messages (role === "status") are rendered as italicised blockquotes.
 *
 * @param messages  Array of ChatMessage from the project store.
 * @param name      Project name — used as the document title and filename.
 */
export function exportChatMarkdown(
  messages: { role: string; content: string }[],
  name: string,
): void {
  if (messages.length === 0) return;

  const lines: string[] = [
    `# ${name}`,
    `_Exported: ${new Date().toISOString()}_`,
    "",
  ];

  for (const msg of messages) {
    if (msg.role === "user") {
      lines.push(`**You:** ${msg.content}`, "");
    } else if (msg.role === "assistant") {
      lines.push(`**Agent:** ${msg.content}`, "");
    } else if (msg.role === "status") {
      lines.push(`> _${msg.content}_`, "");
    }
  }

  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFilename(name)}-chat.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string): string {
  return name.trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-") || "project";
}
