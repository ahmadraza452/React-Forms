import { useState } from "react";
import { useSmartForm } from "@ahmad231/react-formkit";

export default function BasicForm() {
  const [submitted, setSubmitted] = useState<string | null>(null);

  const form = useSmartForm({
    defaultValues: {
      name: "",
      email: "",
      age: 18,
    },

    onSubmit: (values) => {
      setSubmitted(JSON.stringify(values));
    },
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <label>
        Name
        <input {...form.register("name")} />
      </label>

      <label>
        Email
        <input type="email" {...form.register("email")} />
      </label>

      <label>
        Age
        <input type="number" {...form.register("age")} />
      </label>

      <p>
        Live values: {form.watch("name")}, {form.watch("email")}, {form.watch("age")}
      </p>

      {submitted && <p>Submitted: {submitted}</p>}

      <button type="submit" disabled={form.isSubmitting}>
        {form.isSubmitting ? "Submitting..." : "Submit"}
      </button>
    </form>
  );
}
