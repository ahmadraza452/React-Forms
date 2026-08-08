# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

### Changed

- Package version bumped to `0.4.0`.
- `FieldValues` constraint widened to `object` so `interface` form shapes are
  accepted (interfaces have no implicit index signature).
- Removed the temporary `VERSION` placeholder export; `useSmartForm` is now
  the public entry point.
- `zod` added as an optional peer dependency (see `peerDependenciesMeta`).
