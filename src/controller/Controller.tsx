import { useCallback, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

import { getEventValue, isEventLike } from "../core/eventValue";
import type {
  ControllerField,
  ControllerFieldState,
  ControllerProps,
  FieldValues,
  Path,
} from "../core/types";

/**
 * A controlled-component API for a single form field.
 *
 * ```tsx
 * <Controller
 *   control={form.control}
 *   name="email"
 *   render={({ field, fieldState }) => (
 *     <CustomInput {...field} error={fieldState.error?.message} />
 *   )}
 * />
 * ```
 *
 * `field` exposes `name`, `value`, `onChange`, `onBlur` and `ref`.
 * `fieldState` exposes `error`, `invalid`, `touched` and `dirty`, and updates
 * reactively. The component re-renders only when the controlled field changes.
 *
 * Validation reuses the form's existing resolver/validation engine, honoring
 * the `mode` / `reValidateMode` configuration just like `register()` does.
 */
export function Controller<TFieldValues extends FieldValues, TName extends Path<TFieldValues>>(
  props: ControllerProps<TFieldValues, TName>,
): ReactNode {
  const { control, name, render } = props;

  const subscribe = useCallback(
    (listener: () => void) => control.subscribeField(name, listener),
    [control, name],
  );
  const getSnapshot = useCallback(() => control.getSnapshot(), [control]);

  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const state = control.getFieldState(name);

  const fieldState: ControllerFieldState = {
    error: state.error,
    invalid: state.invalid,
    touched: state.touched,
    dirty: state.dirty,
  };

  const field: ControllerField<TFieldValues, TName> = {
    name,
    value: state.value,
    onChange: (...event: unknown[]) => {
      const raw = event[0];
      if (isEventLike(raw)) {
        control.updateField(name, (getEventValue(raw) ?? state.value) as TFieldValues[TName]);
      } else {
        control.updateField(name, raw as TFieldValues[TName]);
      }
    },
    onBlur: () => control.blurField(name),
    ref: (element: HTMLElement | null) => control.setFieldRef(name, element),
  };

  return render({ field, fieldState });
}
