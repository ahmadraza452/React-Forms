import type { FieldValues, ReValidateMode, ValidationMode, Validator } from "../core/types";

/**
 * The core type definitions (errors, results, validators, modes and field
 * paths) live in `../core/types` and are re-exported here so the validation
 * module exposes a single, consistent set of types without duplicating
 * definitions that could drift apart.
 */
export type {
  FieldError,
  FieldErrors,
  FieldState,
  FieldValues,
  Path,
  PathValue,
  ReValidateMode,
  ValidationMode,
  ValidationResult,
  Validator,
} from "../core/types";

/**
 * Options for the validation system.
 */
export interface ValidationOptions<TFieldValues extends FieldValues> {
  /** The validation resolver function. */
  validate?: Validator<TFieldValues>;
  /** When to validate the form. Default: "onSubmit". */
  mode?: ValidationMode;
  /** When to re-validate a field that already has an error. Default: "onChange". */
  reValidateMode?: ReValidateMode;
}
