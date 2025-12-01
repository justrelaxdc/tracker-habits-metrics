import { createContext } from "preact";
import { useContext } from "preact/hooks";
import type { TrackerContextValue } from "./types";

/**
 * Context for sharing plugin and common props across tracker components
 */
export const TrackerContext = createContext<TrackerContextValue | null>(null);

/**
 * Hook to access tracker context
 */
export function useTrackerContext(): TrackerContextValue {
  const context = useContext(TrackerContext);
  if (!context) {
    throw new Error("useTrackerContext must be used within TrackerContext.Provider");
  }
  return context;
}

