import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { memo } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { useSmartForm, useWatch, type UseSmartFormReturn } from "../src/index";
import { createFieldSubscriptionStore } from "../src/core/store";

interface FormValues {
  email: string;
  password: string;
}

const defaultValues: FormValues = { email: "", password: "" };

afterEach(() => {
  cleanup();
});

describe("subscription cleanup - store", () => {
  it("stops notifying a listener after unsubscribe", () => {
    const store = createFieldSubscriptionStore();
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls += 1;
    });

    store.notify(["email"]);
    expect(calls).toBe(1);

    unsubscribe();
    store.notify(["email"]);
    expect(calls).toBe(1);
  });

  it("stops notifying a field listener after unsubscribe", () => {
    const store = createFieldSubscriptionStore();
    let calls = 0;
    const unsubscribe = store.subscribeField("email", () => {
      calls += 1;
    });

    store.notify(["email"]);
    expect(calls).toBe(1);

    unsubscribe();
    store.notify(["email"]);
    expect(calls).toBe(1);
  });

  it("does not notify other field listeners for a different field", () => {
    const store = createFieldSubscriptionStore();
    let emailCalls = 0;
    let passwordCalls = 0;

    store.subscribeField("email", () => {
      emailCalls += 1;
    });
    store.subscribeField("password", () => {
      passwordCalls += 1;
    });

    store.notify(["password"]);
    expect(emailCalls).toBe(0);
    expect(passwordCalls).toBe(1);
  });

  it("removes empty field listener maps on unsubscribe (no leak)", () => {
    const store = createFieldSubscriptionStore();
    const unsubscribe = store.subscribeField("email", () => {});

    unsubscribe();
    // Re-subscribing must work; the internal map entry is gone so a notify
    // for a subscribed-after-removal listener still fires.
    let calls = 0;
    store.subscribeField("email", () => {
      calls += 1;
    });
    store.notify(["email"]);
    expect(calls).toBe(1);
  });

  it("deduplicates the same listener for the same field", () => {
    const store = createFieldSubscriptionStore();
    let calls = 0;
    const listener = () => {
      calls += 1;
    };

    // Subscribing the same listener twice is a no-op (Set semantics).
    const unsubscribeA = store.subscribeField("email", listener);
    store.subscribeField("email", listener);

    store.notify(["email"]);
    expect(calls).toBe(1);

    // Unsubscribing once removes the (single) entry.
    unsubscribeA();
    store.notify(["email"]);
    expect(calls).toBe(1);
  });
});

describe("subscription cleanup - components", () => {
  it("does not update a useWatch component after it unmounts", () => {
    const holder: { current: UseSmartFormReturn<FormValues> | null } = { current: null };
    const rendered = { current: 0 };

    const EmailWatcher = memo(function EmailWatcher() {
      rendered.current += 1;
      const email = useWatch({ control: holder.current!.control, name: "email" });
      return <p data-testid="watched">{email}</p>;
    });

    function Harness({ showWatcher }: { showWatcher: boolean }) {
      const form = useSmartForm({ defaultValues });
      holder.current = form;
      return (
        <div>
          {showWatcher && <EmailWatcher />}
          <input aria-label="email" {...form.register("email")} />
        </div>
      );
    }

    const { rerender } = render(<Harness showWatcher />);
    expect(rendered.current).toBe(1);

    rerender(<Harness showWatcher={false} />);
    const rendersBefore = rendered.current;

    // Unmounted watcher must not be invoked by subsequent form changes.
    fireEvent.change(screen.getByLabelText("email"), { target: { value: "a@b.c" } });
    expect(rendered.current).toBe(rendersBefore);
  });

  it("removes only its own subscription when a subscriber unmounts", () => {
    const holder: { current: UseSmartFormReturn<FormValues> | null } = { current: null };
    const firstRenders = { current: 0 };
    const secondRenders = { current: 0 };

    function Watcher({ label, renders }: { label: string; renders: { current: number } }) {
      renders.current += 1;
      const email = useWatch({ control: holder.current!.control, name: "email" });
      return <p data-testid={label}>{email}</p>;
    }
    const MemoWatcher = memo(Watcher);

    function Harness({ showFirst }: { showFirst: boolean }) {
      const form = useSmartForm({ defaultValues });
      holder.current = form;
      return (
        <div>
          {showFirst && <MemoWatcher label="first" renders={firstRenders} />}
          <MemoWatcher label="second" renders={secondRenders} />
          <input aria-label="email" {...form.register("email")} />
        </div>
      );
    }

    const { rerender } = render(<Harness showFirst />);
    expect(firstRenders.current).toBe(1);
    expect(secondRenders.current).toBe(1);

    rerender(<Harness showFirst={false} />);

    fireEvent.change(screen.getByLabelText("email"), { target: { value: "a@b.c" } });
    expect(firstRenders.current).toBe(1); // unmounted: no updates
    expect(secondRenders.current).toBe(2); // still subscribed: updates
  });

  it("does not leak a duplicate subscription when a component re-renders with a new control", () => {
    // The component subscribes per render identity of `control`; switching
    // controls must not stack up listeners on the old form.
    const holderA: { current: UseSmartFormReturn<FormValues> | null } = { current: null };
    const holderB: { current: UseSmartFormReturn<FormValues> | null } = { current: null };
    const renders = { current: 0 };

    function Watcher({ control }: { control: UseSmartFormReturn<FormValues>["control"] }) {
      renders.current += 1;
      const email = useWatch({ control, name: "email" });
      return <p data-testid="watched">{email}</p>;
    }
    const MemoWatcher = memo(Watcher);

    function Harness({ useB }: { useB: boolean }) {
      const formA = useSmartForm({ defaultValues });
      const formB = useSmartForm({ defaultValues });
      holderA.current = formA;
      holderB.current = formB;
      return (
        <div>
          <MemoWatcher control={useB ? formB.control : formA.control} />
          <input aria-label="a" {...formA.register("email")} />
          <input aria-label="b" {...formB.register("email")} />
        </div>
      );
    }

    const { rerender } = render(<Harness useB={false} />);
    expect(renders.current).toBe(1);

    rerender(<Harness useB={true} />);
    expect(renders.current).toBe(2); // one re-render from the control switch

    // Changing form A must no longer re-render the watcher (unsubscribed
    // from A when the control switched).
    fireEvent.change(screen.getByLabelText("a"), { target: { value: "fromA" } });
    expect(screen.getByTestId("watched").textContent).toBe("");
    expect(renders.current).toBe(2);

    // Changing form B re-renders the watcher exactly once.
    fireEvent.change(screen.getByLabelText("b"), { target: { value: "fromB" } });
    expect(screen.getByTestId("watched").textContent).toBe("fromB");
    expect(renders.current).toBe(3);
  });

  it("does not re-render a subscriber when an unrelated value changes", () => {
    const holder: { current: UseSmartFormReturn<FormValues> | null } = { current: null };
    const renders = { current: 0 };

    function Watcher() {
      renders.current += 1;
      const email = useWatch({ control: holder.current!.control, name: "email" });
      return <p data-testid="watched">{email}</p>;
    }
    const MemoWatcher = memo(Watcher);

    function Harness() {
      const form = useSmartForm({ defaultValues });
      holder.current = form;
      return (
        <div>
          <MemoWatcher />
          <input aria-label="password" {...form.register("password")} />
        </div>
      );
    }

    render(<Harness />);
    expect(renders.current).toBe(1);

    fireEvent.change(screen.getByLabelText("password"), { target: { value: "x" } });
    expect(renders.current).toBe(1);
  });
});
