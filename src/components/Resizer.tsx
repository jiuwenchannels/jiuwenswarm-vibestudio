/**
 * Resizer — a thin drag handle that turns pointer movement into a size delta.
 *
 * Used horizontally (between the chat and preview columns) and vertically
 * (above the code drawer). Pointer capture keeps the drag alive even when the
 * pointer leaves the handle.
 */
import { useRef, useState, type ReactNode } from "react";

interface Props {
  direction: "horizontal" | "vertical";
  onDrag: (delta: number) => void;
  className?: string;
}

export function Resizer({ direction, onDrag, className = "" }: Props): ReactNode {
  const [active, setActive] = useState(false);
  const last = useRef(0);

  const axis: "clientX" | "clientY" =
    direction === "horizontal" ? "clientX" : "clientY";

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    setActive(true);
    last.current = e[axis];
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!active) return;
    const pos = e[axis];
    onDrag(pos - last.current);
    last.current = pos;
  };

  const onPointerUp = (): void => setActive(false);

  const base =
    direction === "horizontal"
      ? "w-1.5 cursor-col-resize"
      : "h-1.5 cursor-row-resize";

  return (
    <div
      role="separator"
      aria-orientation={direction === "horizontal" ? "vertical" : "horizontal"}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`${base} shrink-0 touch-none select-none transition-colors
                  ${active ? "bg-brand-500/50" : "bg-transparent hover:bg-brand-500/30"}
                  ${className}`}
    />
  );
}
