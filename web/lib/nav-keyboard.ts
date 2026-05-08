import type { KeyboardEvent } from "react";

/**
 * Moves focus among direct `a[href]` descendants for horizontal segmented controls (Home/End and Arrow keys).
 * Call from `onKeyDown` on the wrapper around those links only.
 */
export function handleHorizontalNavAnchors<E extends HTMLElement>(e: KeyboardEvent<E>): void {
  if (e.defaultPrevented) return;
  const key = e.key;
  if (key !== "ArrowRight" && key !== "ArrowLeft" && key !== "Home" && key !== "End") return;

  const root = e.currentTarget;
  const anchors = [...root.querySelectorAll<HTMLAnchorElement>("a[href]:not([tabindex='-1'])")].filter((a) =>
    root.contains(a),
  );
  if (anchors.length === 0) return;

  const i = anchors.indexOf(document.activeElement as HTMLAnchorElement);

  const focusAt = (next: number) => {
    const len = anchors.length;
    const j = ((next % len) + len) % len;
    anchors[j]?.focus();
  };

  e.preventDefault();

  switch (key) {
    case "Home":
      focusAt(0);
      break;
    case "End":
      focusAt(anchors.length - 1);
      break;
    case "ArrowRight":
      if (i < 0) {
        focusAt(0);
        break;
      }
      focusAt(i + 1);
      break;
    case "ArrowLeft":
      if (i < 0) {
        focusAt(anchors.length - 1);
        break;
      }
      focusAt(i - 1);
      break;
    default:
      break;
  }
}
