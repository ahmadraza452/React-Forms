# @ahmad231/react-formkit

A lightweight, TypeScript-first form state and validation library for React.

> **Status: stable** — `v1.1.0` is published on npm.

## Quick start (v1.1.0)

```tsx
import { useSmartForm } from "@ahmad231/react-formkit";

function Signup() {
  const form = useSmartForm({
    defaultValues: { email: "", password: "", terms: false },
    shouldFocusError: true,
    onSubmit: async (values) => {
      await createAccount(values);
    },
  });

  return (
    <form onSubmit={form.handleSubmit} noValidate>
      <label>Email</label>
      <input
        type="email"
        aria-invalid={!!form.errors.email}
        aria-describedby={form.errors.email ? "email-error" : undefined}
        {...form.register("email", {
          required: "Email is required",
          pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email" },
        })}
      />
      {form.errors.email && <p id="email-error">{form.errors.email.message}</p>}

      <label>Password</label>
      <input
        type="password"
        aria-invalid={!!form.errors.password}
        {...form.register("password", {
          required: "Password is required",
          minLength: { value: 8, message: "Use at least 8 characters" },
        })}
      />
      {form.errors.password && <p>{form.errors.password.message}</p>}

      <label>
        <input
          type="checkbox"
          {...form.register("terms", {
            type: "checkbox",
            required: "Accept the terms",
          })}
        />{" "}
        Accept the terms
      </label>
      {form.errors.terms && <p>{form.errors.terms.message}</p>}
      <button type="submit" disabled={form.isSubmitting}>
        Create account
      </button>
    </form>
  );
}
```

Rules run in order: `required`, length, numeric range, `pattern`, then custom
`validate(value, values)`. A custom validator returns `true`/`undefined` for
success or a string error message. Optional empty values skip all rules except
`required`; empty includes `""`, `null`, `undefined`, `false`, `NaN`, and an empty array.

Use explicit registrations for native controls: `register("terms", { type: "checkbox" })`,
`register("plan", { type: "radio", value: "pro" })`, and
`register("tags", { type: "select-multiple" })`. `setFocus(name)` focuses a
mounted field; `shouldFocusError: true` focuses the first enabled invalid field after submit.

## Why @ahmad231/react-formkit?

- **Type-safe by design** — field names and values are checked against your
  form shape at compile time; no stringly-typed access.
- **Tiny and dependency-free** — no runtime dependencies. `zod` is optional
  and never bundled.
- **Zero UI assumptions** — bring your own components. Native inputs via
  `register()`, controlled components via `Controller`.
- **Precise re-renders** — field-level subscriptions mean unrelated fields
  don't cause unnecessary re-renders.
- **Complete submission story** — `handleSubmit` with `isSubmitting`,
  `isSubmitted`, `submitCount`, and server error handling with
  `setError()` / `setErrors()`.

## Features

### Implemented

- Lightweight, dependency-free form state management for React.
- Type-safe values inferred from your form shape or provided explicitly.
- `getValues()`, `getValue(name)`, `setValue(name, value)`.
- `register()` to connect native `input`, `textarea` and `select` elements.
- Built-in field rules through `register(name, options)`: `required`, length,
  numeric range, pattern and sync/async custom validation.
- Native boolean checkboxes, radio groups and multiple selects through explicit
  registration options.
- `setFocus(name)` and opt-in invalid-submit focus with `shouldFocusError`.
- `reset()` and `reset(values)`.
- Form state: `isDirty`, `dirtyFields`, `touchedFields`, `getFieldState(name)`.
- Validation via `trigger()`, `errors`, `isValid` and validation modes
  (`onSubmit`, `onBlur`, `onChange` + `reValidateMode`).
- Generic validation/resolver system (sync, async, combined validators).
- Optional Zod integration via `zodResolver(schema)`.
- Form submission: `handleSubmit()`, `onSubmit`, `onError`, `isSubmitting`,
  `isSubmitted` and `submitCount`.
- Watching values: `watch()`, `watch(name)`, `watch([names])` and the
  `useWatch()` hook with field-level subscriptions.
- Controlled components via `Controller` (reuses the validation engine).
- Advanced field API: `resetField(name)`, `setValue` options
  (`shouldValidate`, `shouldTouch`, `shouldDirty`), `form.control`.
- Server/API error handling: `setError()`, `setErrors()` and root-level
  errors, surfaced through `errors`, `isValid` and `handleSubmit`'s `onError`.
- No mutation of the `defaultValues` object you pass in.
- No UI components required — bring your own.

### Planned

- Yup and Valibot resolvers.
- Nested field-path support (`"user.name"`, arrays).

## Installation

```bash
npm install @ahmad231/react-formkit
```

`@ahmad231/react-formkit` declares `react` as a peer dependency. It supports React 18
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
import { useSmartForm } from "@ahmad231/react-formkit";

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
- **Checkboxes** use `register("accepted", { type: "checkbox" })` and store a
  boolean. **Radio groups** use one registration per option, for example
  `register("plan", { type: "radio", value: "pro" })`. **Multiple selects**
  use `register("tags", { type: "select-multiple" })` and store a string array.

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
import { useSmartForm, zodResolver } from "@ahmad231/react-formkit";

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
import { useSmartForm, zodResolver } from "@ahmad231/react-formkit";

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

### Server errors (`setError()` / `setErrors()`)

Client validation cannot know about server-side failures (e.g. an email that
is already taken). Set those errors programmatically after the API responds —
they behave exactly like validation errors: they appear in `form.errors`,
make `isValid` `false`, are passed to `handleSubmit`'s `onError` and can be
cleared with `clearErrors()`:

```tsx
const form = useSmartForm({
  defaultValues: { email: "", password: "" },

  onSubmit: async (values) => {
    const response = await signup(values);
    if (!response.ok) {
      // Field-level server error:
      form.setError("email", { message: response.message });
      // Or a form-level (root) error that belongs to no field:
      form.setError("root", "Unable to reach the server");
      // Or several at once:
      form.setErrors({
        email: { message: "Email is already taken" },
        password: { message: "Password is too weak" },
      });
    }
  },
});
```

`setError(name, error)` accepts either a full error object (`{ message,
meta? }`) or a plain string. `setErrors(errors)` merges into the current
errors without wiping existing ones.

Errors set by the server are replaced by client validation results: re-
validating a field (e.g. `mode: "onChange"` revalidation) overwrites its
server error, and a passing whole-form validation run clears all errors.
`clearErrors("root")` clears only the form-level error; `clearErrors()` and
`reset()` clear everything.

### API overview

The object returned by `useSmartForm()`:

| Member                                                               | Description                                                                    |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `getValues()` / `getValue(name)`                                     | Current values / a single field value (deep copies).                           |
| `setValue(name, value, options?)`                                    | Programmatic update (optional `shouldValidate`, `shouldTouch`, `shouldDirty`). |
| `register(name)`                                                     | Props to spread onto an input (`name`, `value`, `onChange`, `onBlur`, `ref`).  |
| `watch(...)`                                                         | Reactive value watching (whole form, single field or multiple fields).         |
| `reset(values?)`                                                     | Reset to defaults (or the provided values).                                    |
| `resetField(name)`                                                   | Reset one field (value, error, touched, dirty).                                |
| `getFieldState(name)`                                                | `{ value, error, invalid, touched, dirty }`.                                   |
| `dirtyFields` / `touchedFields` / `isDirty`                          | Dirty/touched state.                                                           |
| `errors` / `isValid`                                                 | Validation + server errors, and whether any exist.                             |
| `trigger(name?)`                                                     | Validate the whole form or one field (returns a promise).                      |
| `clearErrors(name?)` / `setError(name, error)` / `setErrors(errors)` | Manage errors, including `"root"`.                                             |
| `handleSubmit`                                                       | Form `onSubmit` handler (validates, then calls `onSubmit`/`onError`).          |
| `isSubmitting` / `isSubmitted` / `submitCount`                       | Submission state.                                                              |
| `control`                                                            | Stable control object for `useWatch` / `Controller`.                           |

### Watching values

`watch()` returns the current values and is reactive during render — the
component re-renders when the watched values change:

```tsx
const email = form.watch("email");
const [email, password] = form.watch(["email", "password"]);
const allValues = form.watch();
```

Watched values are deep copies; mutating them never touches the form state.

To watch a field from a _different_ component, pass `form.control` to the
`useWatch` hook. It re-renders only when the watched field changes:

```tsx
import { useWatch } from "@ahmad231/react-formkit";

function EmailPreview({ control }: { control: Control<LoginForm> }) {
  const email = useWatch({ control, name: "email" });
  return <p>{email}</p>;
}
```

### Controlled components

`Controller` connects a controlled component to the form. It renders with
`field` (`name`, `value`, `onChange`, `onBlur`, `ref`) and `fieldState`
(`error`, `invalid`, `touched`, `dirty`), and reuses the same validation
engine as `register()`:

```tsx
import { Controller } from "@ahmad231/react-formkit";

<Controller
  control={form.control}
  name="country"
  render={({ field, fieldState }) => (
    <>
      <Select value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
      {fieldState.error && <span>{fieldState.error.message}</span>}
    </>
  )}
/>;
```

`field.onChange` accepts both a native change event and a raw value, so custom
components can call `field.onChange("us")` directly.

### `resetField()`

Resets a single field to its default value and clears its error, touched and
dirty state. Other fields are unaffected:

```ts
form.resetField("email");
```

### Advanced `setValue()`

Programmatic updates never touch or validate by default. Opt in per call:

```ts
form.setValue("email", "test@example.com", {
  shouldValidate: true, // run validation for the field after updating
  shouldTouch: true, // mark the field as touched
  shouldDirty: true, // mark the field as dirty, even if the value equals the default
});
```

## Comparison

|                                                   | @ahmad231/react-formkit  | react-hook-form   | Formik            |
| ------------------------------------------------- | ------------------------ | ----------------- | ----------------- |
| Runtime dependencies                              | none                     | none              | several           |
| Package size                                      | small; inspect release   | varies by version | varies by version |
| TypeScript-first                                  | yes                      | yes               | partial           |
| Zod resolver                                      | built-in (`zodResolver`) | separate package  | separate packages |
| Field-level subscriptions                         | yes                      | yes               | no                |
| Validation modes (`onChange`/`onBlur`/`onSubmit`) | yes                      | yes               | partial           |
| Server errors (`setError`/root errors)            | yes                      | yes               | yes               |
| Nested paths / field arrays                       | planned                  | yes               | yes               |
| Browser support                                   | React 18+                | React 16.8+       | React 16.8+       |

@ahmad231/react-formkit is the right choice when you want a small, focused, fully
typed form engine with first-party Zod support and no extra dependencies.
If you need nested field paths, dynamic field arrays or a larger ecosystem
today, react-hook-form is the more mature option.

## Examples

Copy-paste-ready examples live in the
[`examples/`](./examples) directory:

- [`basic.tsx`](./examples/basic.tsx) — native inputs with `register()`.
- [`zod.tsx`](./examples/zod.tsx) — validation with `zodResolver`.
- [`controller.tsx`](./examples/controller.tsx) — custom components via
  `Controller`.
- [`server-errors.tsx`](./examples/server-errors.tsx) — API errors with
  `setError()` / `setErrors()`.

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
- [x] `watch()` and reactive value watching.
- [x] `Controller` component for controlled fields.
- [x] `useWatch()` hook with field-level subscriptions.
- [x] `resetField()`, advanced `setValue()` options, stable `control`.
- [x] Server error handling: `setError()`, `setErrors()`, root errors.
- [x] Error handling and ergonomics for async submissions.
- [x] Publish to npm (`@ahmad231/react-formkit` v1.0.0).
- [ ] Nested field-path support (`"user.name"`, arrays).
- [ ] Yup resolver.
- [ ] Valibot resolver.

## License

[MIT](./LICENSE)
