# react-smart-form

A lightweight, type-safe form state and validation library for React.

> **Status: early development**
>
> The **core form engine** (`useSmartForm`), **field registration**
> (`register()`), the **generic validation/resolver system**, the **Zod
> resolver** (`zodResolver()`) and **form submission** (`handleSubmit`) are
> implemented. `Controller` and related features are planned and have **not**
> been implemented yet. Do not use this package in production.

## Features

### Implemented

- Lightweight, dependency-free form state management for React.
- Type-safe values inferred from your form shape or provided explicitly.
- `getValues()`, `getValue(name)`, `setValue(name, value)`.
- `register()` to connect native `input`, `textarea` and `select` elements.
- `reset()` and `reset(values)`.
- Form state: `isDirty`, `dirtyFields`, `touchedFields`, `getFieldState(name)`.
- Validation via `trigger()`, `errors`, `isValid` and validation modes
  (`onSubmit`, `onBlur`, `onChange` + `reValidateMode`).
- Generic validation/resolver system (sync, async, combined validators).
- Optional Zod integration via `zodResolver(schema)`.
- Form submission: `handleSubmit()`, `onSubmit`, `onError`, `isSubmitting`,
  `isSubmitted` and `submitCount`.
- No mutation of the `defaultValues` object you pass in.
- No UI components required — bring your own.

### Planned

- Yup and Valibot resolvers.
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

Zod integration is **optional**. `zodResolver` is part of the package, but `zod`
itself is an optional peer dependency — install it only if you use Zod:

```bash
npm install zod
```

The library never imports `zod` at runtime; Zod is used only as a type-level
dependency, so the package stays lightweight for users who validate with
custom functions.

## Usage

```tsx
import { useSmartForm } from "react-smart-form";

const form = useSmartForm({
  defaultValues: {
    name: "",
    email: "",
    age: 0,
  },
});

return (
  <form>
    <input {...form.register("name")} />
    <input type="email" {...form.register("email")} />
    <input type="number" {...form.register("age")} />
  </form>
);
```

Typing into a registered field updates the form automatically:

```ts
form.getValue("email"); // latest value
form.isDirty; // true once any field differs from its default
form.dirtyFields.email; // true when the email field is dirty
form.touchedFields.email; // true once the field has been blurred
form.getFieldState("email"); // { value, touched, dirty }
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

<form>
  <input {...form.register("email")} />
  <input type="password" {...form.register("password")} />
</form>;

form.setValue("email", "test@example.com"); // OK
form.setValue("email", 123); // TypeScript error
form.register("doesNotExist"); // TypeScript error
```

When no generic is provided, the shape is inferred from `defaultValues`.

### Input type behavior

- **Text-like inputs** (`text`, `email`, `password`, `textarea`, `select`,
  etc.) store `event.target.value` as a string.
- **Number inputs** store `event.target.valueAsNumber`, so `age: number`
  fields hold real numbers at runtime (consistent with their type). When a
  number input is cleared, the stored value is `NaN` and the input displays an
  empty string.
- Registering the same field with a mismatched input type (e.g. a `text`
  input on a `number` field) is the caller's responsibility.

### Handlers and overrides

Spreading `register("email")` returns `name`, `value`, `onChange`, `onBlur`
and `ref`. If you spread additional props after `register(...)`, standard
React semantics apply — the later prop wins. Overriding `onChange` after the
spread therefore disables the automatic form update; call `setValue` manually
in that case.

### Validation with Zod

Zod integration is optional. Pass `zodResolver(schema)` as the `validate`
option:

```tsx
import { z } from "zod";
import { useSmartForm, zodResolver } from "react-smart-form";

const schema = z.object({
  email: z.string().email(),
});

const form = useSmartForm({
  defaultValues: {
    email: "",
  },

  validate: zodResolver(schema),
});
```

Zod validation errors are mapped to the form's error format. Each field's
error message is exposed through `form.errors`:

```tsx
{
  form.errors.email?.message;
}
```

For example, with:

```ts
z.string().email("Invalid email");
```

an empty or invalid `email` produces:

```ts
{
  errors: {
    email: {
      message: "Invalid email";
    }
  }
}
```

The resolver also supports custom messages, multiple fields, nested object
paths (e.g. `"user.name"`), array paths (e.g. `"users.0.email"`) and Zod
transforms/coercion (e.g. `z.coerce.number()`). On success the resolver
returns Zod's parsed values, so coercions and transforms are preserved.

Validation modes and `trigger()` work the same as with any other validator:

```tsx
const isValid = await form.trigger(); // validate the whole form
const isEmailValid = await form.trigger("email"); // validate one field
```

### Form submission

Connect the form's `handleSubmit` directly to the `<form>` element's
`onSubmit` — the browser's default submission behavior is prevented
automatically:

```tsx
import { useSmartForm, zodResolver } from "react-smart-form";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const form = useSmartForm({
  defaultValues: {
    email: "",
    password: "",
  },

  validate: zodResolver(schema),

  onSubmit: async (values) => {
    await login(values);
  },

  onError: (errors) => {
    console.log(errors);
  },
});

return (
  <form onSubmit={form.handleSubmit}>
    <input {...form.register("email")} />

    <input type="password" {...form.register("password")} />

    {form.errors.email?.message}

    <button type="submit" disabled={form.isSubmitting}>
      {form.isSubmitting ? "Logging in..." : "Login"}
    </button>
  </form>
);
```

Submission lifecycle:

1. `handleSubmit` prevents the default browser behavior and runs validation.
2. If validation **fails**, the form errors are populated and `onError(errors)`
   is called. `onSubmit` is **not** executed.
3. If validation **passes**, `onSubmit(values)` is called with the validated
   values. When a resolver transforms values (e.g. Zod coercion with
   `z.coerce.number()`), the parsed values are passed to `onSubmit`.
4. `isSubmitting` is `true` while an async `onSubmit` is running and is always
   reset to `false` when it finishes — even if `onSubmit` throws. Duplicate
   submissions are ignored while one is already in progress.

Submission state:

- `isSubmitting` — `true` while a submission is in progress.
- `isSubmitted` — `true` after any submission attempt, including attempts that
  fail validation.
- `submitCount` — the number of submission attempts made.

`onSubmit` only runs after successful validation. If `onSubmit` throws, the
error is not swallowed — the promise returned by `handleSubmit` rejects and
`isSubmitting` is reset.

After a successful submission the form is **not** reset automatically. Call
`form.reset()` explicitly when you want to clear the form; `reset()` also
resets `isSubmitting`, `isSubmitted`, `submitCount`, errors, dirty and touched
state.

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
- [x] Field registration (`register()` for `input`, `textarea`, `select`).
- [x] Form state: `dirtyFields`, `touchedFields`, `getFieldState()`.
- [x] Validation: `trigger()`, `errors`, `isValid`, validation modes.
- [x] Generic validation/resolver system.
- [x] Zod resolver (`zodResolver`).
- [x] Form submission: `handleSubmit()`, `onSubmit`/`onError`, `isSubmitting`,
      `isSubmitted`, `submitCount`.
- [ ] Nested field-path support (`"user.name"`, arrays).
- [ ] Yup resolver.
- [ ] Valibot resolver.
- [ ] `Controller` component for controlled fields.
- [ ] `watch()`.
- [ ] Error handling and ergonomics for async submissions.
- [ ] Publish to npm.

## License

[MIT](./LICENSE)
