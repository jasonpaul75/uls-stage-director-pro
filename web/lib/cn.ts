/** Concatenate truthy Tailwind-ish class fragments (no intelligent merge — avoid conflicting atoms). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
