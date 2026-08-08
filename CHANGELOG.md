# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
