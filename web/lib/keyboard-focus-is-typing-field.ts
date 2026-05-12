/** Typed input / editable focus — callers avoid hijacking normal key behavior for workspace shortcuts. */
export function keyboardFocusIsTypingField(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  const t = (el as HTMLInputElement).type;
  if (
    t === "button" ||
    t === "submit" ||
    t === "checkbox" ||
    t === "radio" ||
    t === "range" ||
    t === "hidden" ||
    t === "file"
  )
    return false;
  return true;
}
