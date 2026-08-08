/**
 * A tiny, dependency-free field-subscription store.
 *
 * The form uses this store so components that subscribe to specific fields
 * (`useWatch`, `Controller`) re-render only when those fields actually change,
 * instead of re-rendering on every form-wide change.
 *
 * Each `notify` call bumps a monotonically increasing version number and
 * invokes the listeners that care about the changed fields. Components use the
 * version number as the `getSnapshot` value for `useSyncExternalStore`, so an
 * unchanged snapshot prevents unnecessary re-renders.
 */
export interface FieldSubscriptionStore {
  /** Subscribes to all form value/state changes. Returns an unsubscribe function. */
  subscribe: (listener: () => void) => () => void;
  /** Subscribes to changes of a single field. Returns an unsubscribe function. */
  subscribeField: (name: string, listener: () => void) => () => void;
  /** The current store version, used as the snapshot for subscriptions. */
  getVersion: () => number;
  /** Bumps the version and notifies listeners subscribed to the given fields. */
  notify: (changedFields: readonly string[]) => void;
}

/**
 * Creates a new {@link FieldSubscriptionStore}.
 */
export function createFieldSubscriptionStore(): FieldSubscriptionStore {
  let version = 0;
  const allListeners = new Set<() => void>();
  const fieldListeners = new Map<string, Set<() => void>>();

  return {
    subscribe(listener) {
      allListeners.add(listener);
      return () => {
        allListeners.delete(listener);
      };
    },
    subscribeField(name, listener) {
      let listeners = fieldListeners.get(name);
      if (!listeners) {
        listeners = new Set();
        fieldListeners.set(name, listeners);
      }
      listeners.add(listener);
      return () => {
        listeners!.delete(listener);
        // Drop the field entry entirely once it has no subscribers so the
        // store does not keep empty maps (and the fields) alive forever.
        if (listeners!.size === 0) {
          fieldListeners.delete(name);
        }
      };
    },
    getVersion() {
      return version;
    },
    notify(changedFields) {
      version += 1;
      const notified = new Set<() => void>();
      for (const listener of allListeners) {
        notified.add(listener);
        listener();
      }
      for (const name of changedFields) {
        const listeners = fieldListeners.get(name);
        if (!listeners) continue;
        for (const listener of listeners) {
          if (!notified.has(listener)) {
            notified.add(listener);
            listener();
          }
        }
      }
    },
  };
}
