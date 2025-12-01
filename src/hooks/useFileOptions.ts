import { useState, useEffect } from "preact/hooks";
import type { TFile } from "obsidian";
import type TrackerPlugin from "../core/tracker-plugin";
import type { TrackerFileOptions } from "../domain/types";

/**
 * Hook to load and manage file options from frontmatter
 */
export function useFileOptions(file: TFile, plugin: TrackerPlugin) {
  const [options, setOptions] = useState<TrackerFileOptions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadOptions = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const data = await plugin.getFileTypeFromFrontmatter(file);
        if (mounted) {
          setOptions(data);
        }
      } catch (err) {
        console.error("useFileOptions: error loading options", err);
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadOptions();

    return () => {
      mounted = false;
    };
  }, [file, plugin]);

  return {
    options,
    isLoading,
    error,
  };
}

