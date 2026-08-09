import { z } from "zod";
import { useSmartForm, zodResolver } from "@ahmad231/react-formkit";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "At least 8 characters"),
});

export default function ZodForm() {
  const form = useSmartForm({
    defaultValues: {
      email: "",
      password: "",
    },

    validate: zodResolver(schema),
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <input {...form.register("email")} placeholder="Email" />
      {form.errors.email && <p>{form.errors.email.message}</p>}

      <input type="password" {...form.register("password")} placeholder="Password" />
      {form.errors.password && <p>{form.errors.password.message}</p>}

      <button type="submit" disabled={form.isSubmitting}>
        {form.isSubmitting ? "Logging in..." : "Login"}
      </button>
    </form>
  );
}
