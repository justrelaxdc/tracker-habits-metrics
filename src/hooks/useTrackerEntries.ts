import { useState, useEffect, useCallback } from "preact/hooks";
import type { TFile } from "obsidian";
import type TrackerPlugin from "../core/tracker-plugin";
import type { TrackerEntries } from "../domain/types";

/**
 * Hook to load and manage tracker entries for a file
 */
export function useTrackerEntries(file: TFile, plugin: TrackerPlugin) {
  const [entries, setEntries] = useState<TrackerEntries>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load entries
  useEffect(() => {
    let mounted = true;

    const loadEntries = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const data = await plugin.readAllEntries(file);
        if (mounted) {
          setEntries(data);
        }
      } catch (err) {
        console.error("useTrackerEntries: error loading entries", err);
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadEntries();

    return () => {
      mounted = false;
    };
  }, [file, plugin]);

  // Refresh entries
  const refresh = useCallback(async () => {
    try {
      const data = await plugin.readAllEntries(file);
      setEntries(data);
    } catch (err) {
      console.error("useTrackerEntries: error refreshing entries", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [file, plugin]);

  return {
    entries,
    isLoading,
    error,
    refresh,
  };
}

