/**
 * react-smart-form
 *
 * A lightweight, type-safe form state and validation library for React.
 *
 * The public API currently includes the core form engine (`useSmartForm`)
 * with field registration, validation and form submission, plus the optional
 * Zod resolver (`zodResolver`). `Controller` and related features will be
 * exported from this entry point in upcoming iterations.
 */

export { useSmartForm } from "./core/useSmartForm";
export { zodResolver } from "./validation";
export type {
  ChangeHandler,
  FieldError,
  FieldErrors,
  FieldState,
  FieldValues,
  Path,
  PathValue,
  ReValidateMode,
  SubmitErrorHandler,
  SubmitHandler,
  UseSmartFormOptions,
  UseSmartFormRegisterReturn,
  UseSmartFormReturn,
  ValidationMode,
  ValidationResult,
  Validator,
} from "./core/types";
