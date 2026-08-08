# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Server/API error handling via `setError(name, error)`, `setErrors(errors)`
  and the reserved `"root"` key for form-level (server) errors. Errors accept
  a full `FieldError` (`{ message, meta? }`) or a plain string message.
  `setErrors` merges into the current errors without wiping existing ones.
- Server errors behave like validation errors: they surface in `errors` and
  `getFieldState()`, make `isValid` `false`, are passed to `handleSubmit`'s
  `onError`, and are cleared by `clearErrors(name)` / `clearErrors()` /
  `reset()`. Client re-validation replaces them.
- `FieldErrors` now includes the `"root"` key; new `ErrorName` type.
- Validation race-condition protection: every validation run (and
  `reset()`/`resetField()`) bumps an internal sequence number, and a result
  that resolves after a newer run started is discarded instead of
  overwriting newer state. This covers async resolvers, `trigger()`,
  `handleSubmit` and validation during rapid changes.
- Consistent error handling for throwing validators: a validator that throws
  now counts as a validation failure (a `"Validation failed"` error on the
  field, or a `"root"` error for whole-form validation) instead of silently
  passing.
- SSR safety: `getEventValue` no longer references DOM constructors directly,
  so the module can be imported in non-DOM environments.
- Subscription-store cleanup: unsubscribing the last listener of a field
  removes the field's listener map (no leaked empty entries).
- Validation types consolidated: `src/validation/types.ts` now re-exports the
  core type definitions instead of duplicating them.
- Tests: server errors (`setError`/`setErrors`/root/clear/Controller/
  register/submission interplay), async validation race conditions (stale
  results, reset/resetField/submit invalidation), subscription cleanup
  (store + component unmounts, duplicate subscriptions), edge cases (empty
  form, 50-field form, null/undefined values, repeated values, reset during
  submission, rapid submissions, unmounted fields) and performance smoke
  benchmarks (100-field forms, isolated watchers, validation overhead).
- CI workflow (`.github/workflows/ci.yml`): install, typecheck, lint, format
  check, test and build on push and pull requests (Node 22).

### Changed

- Package version bumped to `0.7.0`.

### Fixed

- A stale async validation result could overwrite a newer one, or re-populate
  errors after `reset()` / `resetField()`.
- A throwing validator silently passed whole-form validation while failing
  field-level validation (inconsistent error handling).
- `getEventValue` crashed in non-DOM environments when an event-like object
  was passed.
- Empty field-subscription maps stayed in the store after unsubscribing.

## Previous development work (not yet published)

### Added

- Advanced field API:
  - `watch()` — watch the whole form, a single field or multiple fields, with
    correctly typed returns. Reactive during render (the component re-renders
    when the watched values change).
  - `useWatch({ control, name })` — watch a field (or the whole form) from any
    component. Re-renders only when the watched field(s) change.
  - `Controller` — controlled-component API exposing `field` (`name`, `value`,
    `onChange`, `onBlur`, `ref`) and reactive `fieldState` (`error`, `invalid`,
    `touched`, `dirty`). Reuses the existing resolver/validation engine
    (`mode` / `reValidateMode`).
  - `form.control` — stable control object used by `useWatch`/`Controller`;
    exposes subscriptions, reads and the controlled-field mutation bridge.
  - Field-level subscription store: subscribed components are notified only
    when their fields change; unrelated fields do not cause unnecessary
    re-renders. Dependency-free (React `useSyncExternalStore`).
  - `setValue(name, value, options)` — optional `shouldValidate`,
    `shouldTouch` and `shouldDirty`; defaults stay backwards-compatible
    (no touch/validation).
  - `resetField(name)` — resets a single field to its default and clears its
    error, touched and dirty state without affecting other fields.
  - `clearErrors()` / `trigger()` now notify field subscribers reactively.
  - New public types: `Control`, `WatchFunction`, `UseWatchProps`,
    `ControllerProps`, `ControllerRenderProps`, `ControllerField`,
    `ControllerFieldState`, `SetValueOptions`.
- Tests: `watch` (whole/single/multiple, reactivity), `useWatch`, `Controller`
  (value updates, blur, validation modes, reactive error/touched/dirty),
  `setValue` options, `resetField`, field subscriptions (no unnecessary
  updates), advanced type safety (invalid names/value types rejected).
- `register()` now shares its change/blur logic with `Controller` via the
  control bridge, keeping both paths consistent.

### Changed

- Package version bumped to `0.6.0`.

### Added

- Project scaffolding: TypeScript, Vite library mode, Vitest, ESLint, Prettier.
- Core form engine: `useSmartForm` hook with `defaultValues`, `getValues`,
  `getValue`, `setValue`, `reset` and `isDirty`.
- Field registration: `register()` with `name`, `value`, `onChange`, `onBlur`
  and `ref` props.
- Form state: `dirtyFields`, `touchedFields` and `getFieldState()`.
- Per-input-type change handling for `input`, `textarea` and `select`, with
  number inputs stored as numbers via `valueAsNumber`.
- Public types: `FieldValues`, `Path`, `PathValue`, `UseSmartFormOptions`,
  `UseSmartFormReturn`, `UseSmartFormRegisterReturn`, `FieldState`,
  `ChangeHandler`.
- Deep clone / deep equality utilities used by the form engine.
- Component-based test setup (`@testing-library/react` + `jsdom`).
- Runtime behavior tests and compile-time type-safety tests.
- Validation system: `trigger()`, `errors`, `isValid`, `clearErrors()`,
  `getFieldState()` error state, and `mode` / `reValidateMode` options.
- Generic validation/resolver system (`createSyncValidator`,
  `createAsyncValidator`, `combineValidators`, `validateField`, `hasErrors`).
- Zod integration: `zodResolver(schema)` maps Zod issues to the form's
  `FieldError` format, including custom messages, nested object paths and
  array paths, and returns Zod's parsed/transformed values on success. Zod is
  an optional peer dependency and is never bundled (type-only import).
- Zod resolver unit tests, form integration tests and type-inference tests.
- Form submission: `handleSubmit()` (usable directly as a form `onSubmit`
  handler), `onSubmit` / `onError` options, `isSubmitting`, `isSubmitted` and
  `submitCount`. Submission validates before calling `onSubmit`, passes
  resolver-parsed values (e.g. Zod coercion) through, prevents duplicate
  concurrent submissions and resets `isSubmitting` even when `onSubmit`
  throws.
- Submission tests: valid/invalid submission, async `isSubmitting` lifecycle,
  `onSubmit` errors, `submitCount`, `isSubmitted`, reset, duplicate
  submissions and Zod-parsed values reaching `onSubmit`.

### Changed

- Package version bumped to `0.5.0`.
- `FieldValues` constraint widened to `object` so `interface` form shapes are
  accepted (interfaces have no implicit index signature).
- Removed the temporary `VERSION` placeholder export; `useSmartForm` is now
  the public entry point.
- `zod` added as an optional peer dependency (see `peerDependenciesMeta`).
