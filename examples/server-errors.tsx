import { useSmartForm } from "react-smartform";

interface SignupForm {
  email: string;
  password: string;
}

async function signup(values: SignupForm): Promise<{ ok: boolean; message: string }> {
  const response = await fetch("/api/signup", {
    method: "POST",
    body: JSON.stringify(values),
  });
  const body = await response.json();
  return { ok: response.ok, message: body.message ?? "Something went wrong" };
}

export default function SignupForm() {
  const form = useSmartForm({
    defaultValues: { email: "", password: "" },

    onSubmit: async (values) => {
      const result = await signup(values);
      if (!result.ok) {
        form.setError("root", result.message);
        return;
      }
      form.reset();
    },
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <input {...form.register("email")} placeholder="Email" />
      <input type="password" {...form.register("password")} placeholder="Password" />

      {form.errors.root && <p role="alert">{form.errors.root.message}</p>}

      <button type="submit" disabled={form.isSubmitting}>
        {form.isSubmitting ? "Signing up..." : "Sign up"}
      </button>
    </form>
  );
}
