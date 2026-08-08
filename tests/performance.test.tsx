import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { memo } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { Controller, useSmartForm, useWatch, type UseSmartFormReturn } from "../src/index";

afterEach(() => {
  cleanup();
});

/**
 * Lightweight smoke benchmarks. These are NOT authoritative numbers — they
 * exist to catch regressions (e.g. accidental O(n²) behavior) with generous
 * upper bounds. Run `npm test` in CI for correctness; use a profiler for
 * real measurements.
 */
describe("performance smoke benchmarks", () => {
  it("handles a medium form (100 fields) with thousands of updates quickly", () => {
    const values: Record<string, string> = {};
    for (let i = 0; i < 100; i += 1) values[`field${i}`] = "";

    const { result } = renderHookForm(values);

    const start = performance.now();
    for (let i = 0; i < 100; i += 1) {
      act(() => {
        result.setValue(`field${i}`, `value${i}`);
      });
    }
    const elapsed = performance.now() - start;
    console.info(`[perf] 100 fields x 100 setValue calls: ${elapsed.toFixed(1)}ms`);

    expect(elapsed).toBeLessThan(5000);
    expect(result.getValue("field99")).toBe("value99");
  });

  it("keeps per-field subscriptions isolated at scale", () => {
    const values: Record<string, string> = {};
    for (let i = 0; i < 100; i += 1) values[`field${i}`] = "";

    const holder: { current: UseSmartFormReturn<Record<string, string>> | null } = {
      current: null,
    };
    const watcherRenders = { current: 0 };

    const Watcher = memo(function Watcher() {
      watcherRenders.current += 1;
      const value = useWatch({ control: holder.current!.control, name: "field0" });
      return <p data-testid="watched">{value}</p>;
    });

    function Harness() {
      const form = useSmartForm({ defaultValues: values });
      holder.current = form;
      return (
        <div>
          <Watcher />
          {Object.keys(values).map((name) => (
            <input key={name} aria-label={name} {...form.register(name)} />
          ))}
        </div>
      );
    }

    render(<Harness />);
    expect(watcherRenders.current).toBe(1);

    // Updating 99 unrelated fields must not re-render the watcher.
    const start = performance.now();
    for (let i = 1; i < 100; i += 1) {
      fireEvent.change(screen.getByLabelText(`field${i}`), {
        target: { value: `value${i}` },
      });
    }
    const elapsed = performance.now() - start;
    console.info(
      `[perf] 99 unrelated field updates, watcher renders: ${watcherRenders.current} (${elapsed.toFixed(1)}ms)`,
    );

    expect(watcherRenders.current).toBe(1);
    expect(elapsed).toBeLessThan(5000);

    // The watched field still updates the watcher.
    fireEvent.change(screen.getByLabelText("field0"), { target: { value: "changed" } });
    expect(screen.getByTestId("watched").textContent).toBe("changed");
    expect(watcherRenders.current).toBe(2);
  });

  it("validates a medium form without pathological cost", async () => {
    const values: Record<string, string> = {};
    for (let i = 0; i < 100; i += 1) values[`field${i}`] = "";

    const { result } = renderHookForm(values, () => ({ errors: {} }));

    const start = performance.now();
    for (let i = 0; i < 10; i += 1) {
      const valid = await result.trigger();
      expect(valid).toBe(true);
    }
    const elapsed = performance.now() - start;
    console.info(`[perf] 10 full validations of 100-field form: ${elapsed.toFixed(1)}ms`);

    expect(elapsed).toBeLessThan(5000);
  });

  it("Controller updates stay cheap with many controlled fields", () => {
    const values: Record<string, string> = {};
    for (let i = 0; i < 50; i += 1) values[`field${i}`] = "";

    const holder: { current: UseSmartFormReturn<Record<string, string>> | null } = {
      current: null,
    };

    function Harness() {
      const form = useSmartForm({ defaultValues: values });
      holder.current = form;
      return (
        <div>
          {Object.keys(values).map((name) => (
            <Controller
              key={name}
              control={form.control}
              name={name}
              render={({ field }) => <input aria-label={name} {...field} />}
            />
          ))}
        </div>
      );
    }

    render(<Harness />);

    const start = performance.now();
    for (let i = 0; i < 50; i += 1) {
      fireEvent.change(screen.getByLabelText(`field${i}`), { target: { value: `v${i}` } });
    }
    const elapsed = performance.now() - start;
    console.info(`[perf] 50 Controller updates: ${elapsed.toFixed(1)}ms`);

    expect(elapsed).toBeLessThan(5000);
    expect(holder.current?.getValue("field49")).toBe("v49");
  });
});

function renderHookForm(
  defaultValues: Record<string, string>,
  validate?: (values: Record<string, string>) => {
    errors: Partial<Record<string, { message: string }>>;
  },
) {
  let api: UseSmartFormReturn<Record<string, string>> | null = null;

  function Harness() {
    const form = useSmartForm({
      defaultValues,
      ...(validate !== undefined && { validate }),
    });
    api = form;
    return <div />;
  }

  render(<Harness />);
  const form = api as unknown as UseSmartFormReturn<Record<string, string>>;

  return {
    result: {
      setValue: (name: string, value: string) => form.setValue(name, value),
      getValue: (name: string) => form.getValue(name),
      trigger: () => form.trigger(),
    },
  };
}
