# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Project scaffolding: TypeScript, Vite library mode, Vitest, ESLint, Prettier.
- Core form engine: `useSmartForm` hook with `defaultValues`, `getValues`,
  `getValue`, `setValue`, `reset` and `isDirty`.
- Public types: `FieldValues`, `Path`, `PathValue`, `UseSmartFormOptions`,
  `UseSmartFormReturn`.
- Deep clone / deep equality utilities used by the form engine.
- Component-based test setup (`@testing-library/react` + `jsdom`).
- Runtime behavior tests and compile-time type-safety tests for the core
  engine.

### Changed

- Package version bumped to `0.2.0`.
- Removed the temporary `VERSION` placeholder export; `useSmartForm` is now
  the public entry point.
