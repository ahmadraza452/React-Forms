/**
 * react-smart-form
 *
 * A lightweight, type-safe form state and validation library for React.
 *
 * The public API currently includes the core form engine (`useSmartForm`).
 * Validation resolvers, `register`, `handleSubmit`, `Controller` and related
 * features will be exported from this entry point in upcoming iterations.
 */

export { useSmartForm } from "./core/useSmartForm";
export type {
  FieldValues,
  Path,
  PathValue,
  UseSmartFormOptions,
  UseSmartFormReturn,
} from "./core/types";
