/**
 * @ahmad231/react-formkit
 *
 * A lightweight, type-safe form state and validation library for React.
 *
 * The public API includes the core form engine (`useSmartForm`) with field
 * registration, validation, form submission, watching and controlled fields,
 * plus the optional Zod resolver (`zodResolver`).
 */

export { useSmartForm } from "./core/useSmartForm";
export { Controller } from "./controller/Controller";
export { useWatch } from "./controller/useWatch";
export { zodResolver } from "./validation";
export type {
  ChangeHandler,
  Control,
  ControllerField,
  ControllerFieldState,
  ControllerProps,
  ControllerRenderProps,
  ErrorName,
  FieldError,
  FieldErrors,
  FieldState,
  FieldValues,
  Path,
  PathValue,
  ReValidateMode,
  SetValueOptions,
  SubmitErrorHandler,
  SubmitHandler,
  UseSmartFormOptions,
  UseSmartFormRegisterReturn,
  UseSmartFormReturn,
  UseWatchProps,
  ValidationMode,
  ValidationResult,
  Validator,
  WatchFunction,
} from "./core/types";
