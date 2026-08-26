import { useComputed } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { setIcon } from "obsidian";
import { trackerStore } from "../../store";
import { setCssProps } from "../../utils/theme";

export interface IconProps {
  /** Path to file or folder for icon lookup */
  path: string;
  /** Whether the path is a file (true) or folder (false) */
  isFile?: boolean;
  /** Additional CSS class */
  className?: string;
}

/**
 * Declarative Icon component
 * Uses signals to reactively update when iconize data changes
 */
export function Icon({ path, className = "" }: IconProps) {
  const iconRef = useRef<HTMLSpanElement>(null);
  const previousIconTypeRef = useRef<'lucide' | 'emoji' | null>(null);
  
  // Get icon reactively from store
  // Get icon reactively from store
  // Access iconizeData.value directly to ensure reactivity
  const icon = useComputed<string | null>(() => {
    const data = trackerStore.iconizeData.value;
    if (!data) return null;
    
    // Normalize path: convert backslashes, collapse multiple slashes, remove leading/trailing slashes
    const normalizedPath = path
      .replace(/\\/g, "/")
      .replace(/\/+/g, "/")
      .replace(/^\/+/, "")
      .replace(/\/$/, "");

    const getIconStr = (key: string): string | null => {
      const val = data[key];
      return typeof val === "string" ? val : null;
    };

    // Try exact match first
    const exact = getIconStr(normalizedPath);
    if (exact) return exact;

    // Try with leading slash
    const pathWithSlash = `/${normalizedPath}`;
    const withSlash = getIconStr(pathWithSlash);
    if (withSlash) return withSlash;

    // For files, try without extension
    if (normalizedPath.endsWith(".md")) {
      const pathWithoutExt = normalizedPath.slice(0, -3);
      const withoutExt = getIconStr(pathWithoutExt);
      if (withoutExt) return withoutExt;
      const withoutExtSlash = getIconStr(`/${pathWithoutExt}`);
      if (withoutExtSlash) return withoutExtSlash;
    }

    return null;
  });

  // Render icon using Obsidian API for Lucide, text for emoji
  useEffect(() => {
    if (!iconRef.current || !icon.value || typeof icon.value !== "string") {
      // Clear if icon is removed
      if (iconRef.current) {
        while (iconRef.current.firstChild) {
          iconRef.current.removeChild(iconRef.current.firstChild);
        }
      }
      previousIconTypeRef.current = null;
      return;
    }

    const iconValue: string = icon.value;
    const isLucide = iconValue.startsWith("Li");
    const currentIconType = isLucide ? 'lucide' : 'emoji';

    // Clear content when switching between icon types or when icon changes
    if (previousIconTypeRef.current !== null && previousIconTypeRef.current !== currentIconType) {
      while (iconRef.current.firstChild) {
        iconRef.current.removeChild(iconRef.current.firstChild);
      }
    }

    // Handle Lucide icons
    if (isLucide) {
      // Remove "Li" prefix and convert PascalCase to kebab-case
      // e.g., "LiAlarmClockCheck" -> "alarm-clock-check"
      const pascalCase = iconValue.substring(2);
      const kebabCase = pascalCase.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
      // Use Obsidian's setIcon to render Lucide icon
      setIcon(iconRef.current, kebabCase);
    } else {
      // Handle emoji - set as text content
      iconRef.current.textContent = iconValue;
    }

    previousIconTypeRef.current = currentIconType;
  }, [icon.value]);

  // Set CSS properties using setCssProps
  useEffect(() => {
    if (iconRef.current) {
      setCssProps(iconRef.current, {
        marginRight: "0.3em",
        display: "inline-block",
      });
    }
  }, []);

  if (!icon.value || typeof icon.value !== "string") {
    return null;
  }

  const iconValue: string = icon.value;
  const isLucide = iconValue.startsWith("Li");

  // Use single element for both icon types
  return (
    <span
      ref={iconRef}
      class={`iconize-icon ${isLucide ? "lucide-icon" : ""} ${className}`.trim()}
      aria-label={iconValue}
    />
  );
}

