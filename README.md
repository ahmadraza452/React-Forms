# react-smart-form

A lightweight, type-safe form state and validation library for React.

> **Status: early development**
>
> The **core form engine is implemented** (`useSmartForm`): values,
> `getValues`/`getValue`/`setValue`, `reset`, and `isDirty`. Validation
> resolvers, `register`, `handleSubmit`, `Controller`, and related features are
> planned and have **not** been implemented yet. Do not use this package in
> production.

## Features

### Implemented

- Lightweight, dependency-free form state management for React.
- Type-safe values inferred from your form shape or provided explicitly.
- `getValues()`, `getValue(name)`, `setValue(name, value)`.
- `reset()` and `reset(values)`.
- `isDirty` form state.
- No UI components required — bring your own.
- No mutation of the `defaultValues` object you pass in.

### Planned

- `register()` and `handleSubmit()`.
- Validation resolver API.
- Zod, Yup, and Valibot resolvers.
- Custom (plain function) resolvers.
- `Controller` for controlled fields.
- Nested field-path support (`"user.name"`, arrays).
- Error handling for async submissions.
- `watch()`.

## Installation

> ⚠️ Not yet published. The command below is a placeholder for the upcoming
> public release.

```bash
npm install react-smart-form
```

`react-smart-form` declares `react` as a peer dependency. It supports React 18
and React 19.

## Usage

```tsx
import { useSmartForm } from "react-smart-form";

const form = useSmartForm({
  defaultValues: {
    name: "",
    email: "",
  },
});

form.setValue("email", "test@example.com");

const email = form.getValue("email"); // "test@example.com"
const values = form.getValues(); // { name: "", email: "test@example.com" }

form.isDirty; // true

form.reset(); // back to { name: "", email: "" }
form.reset({ name: "Ahmad", email: "ahmad@example.com" });
```

### Type safety

Field names and values are checked against your form shape. A typed interface
can be passed explicitly:

```tsx
interface LoginForm {
  email: string;
  password: string;
}

const form = useSmartForm<LoginForm>({
  defaultValues: { email: "", password: "" },
});

form.getValue("email"); // type: string
form.setValue("email", "test@example.com"); // OK
form.setValue("email", 123); // TypeScript error
form.getValue("doesNotExist"); // TypeScript error
```

When no generic is provided, the shape is inferred from `defaultValues`.

## Development

```bash
npm install          # install dependencies
npm test             # run the test suite once
npm run test:watch   # run the test suite in watch mode
npm run typecheck    # type-check the project
npm run lint         # lint the project
npm run format       # format all files with Prettier
npm run format:check # verify formatting
npm run build        # build the distributable package into dist/
```

## Roadmap

- [x] Core form state (`useSmartForm`: values, get/set, reset, `isDirty`).
- [ ] Nested field-path support (`"user.name"`, arrays).
- [ ] `register()` and `handleSubmit()`.
- [ ] Validation resolver API.
- [ ] Zod resolver.
- [ ] Yup resolver.
- [ ] Valibot resolver.
- [ ] Custom (plain function) resolvers.
- [ ] `Controller` component for controlled fields.
- [ ] `watch()`.
- [ ] Error handling and ergonomics for async submissions.
- [ ] Publish to npm.

## License

[MIT](./LICENSE)
