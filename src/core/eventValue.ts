/**
 * Returns `true` when the value looks like a DOM event object (an object that
 * has a `target` property).
 *
 * Used by `Controller`'s `field.onChange`, which must accept both native DOM
 * events and raw values passed by custom components (e.g.
 * `field.onChange("new value")`).
 */
export function isEventLike(value: unknown): boolean {
  return typeof value === "object" && value !== null && "target" in value;
}

/**
 * Extracts the value stored by an input from a DOM event's `target`.
 *
 * Number inputs are stored as numbers via `valueAsNumber` (a cleared number
 * input stores `NaN`, matching the `register()` behavior). Returns `undefined`
 * when the target is not recognized.
 */
export function getEventValue(event: unknown): unknown {
  const target = (event as { target?: EventTarget | null } | undefined)?.target;
  if (target instanceof HTMLInputElement) {
    return target.type === "number" ? target.valueAsNumber : target.value;
  }
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return target.value;
  }
  return (target as { value?: unknown } | undefined)?.value;
}
