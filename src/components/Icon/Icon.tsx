import { useComputed } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { setIcon } from "obsidian";
import { trackerStore } from "../../store";

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
export function Icon({ path, isFile = false, className = "" }: IconProps) {
  const iconRef = useRef<HTMLSpanElement>(null);
  const previousIconTypeRef = useRef<'lucide' | 'emoji' | null>(null);
  
  // Get icon reactively from store
  // Access iconizeData.value directly to ensure reactivity
  const icon = useComputed(() => {
    const data = trackerStore.iconizeData.value;
    if (!data) return null;
    
    // Normalize path: convert backslashes, collapse multiple slashes, remove leading/trailing slashes
    const normalizedPath = path
      .replace(/\\/g, "/")
      .replace(/\/+/g, "/")
      .replace(/^\/+/, "")
      .replace(/\/$/, "");

    // Try exact match first
    if (data[normalizedPath]) {
      return data[normalizedPath];
    }

    // Try with leading slash
    const pathWithSlash = `/${normalizedPath}`;
    if (data[pathWithSlash]) {
      return data[pathWithSlash];
    }

    // For files, try without extension
    if (normalizedPath.endsWith(".md")) {
      const pathWithoutExt = normalizedPath.slice(0, -3);
      if (data[pathWithoutExt]) {
        return data[pathWithoutExt];
      }
      if (data[`/${pathWithoutExt}`]) {
        return data[`/${pathWithoutExt}`];
      }
    }

    return null;
  });

  // Render icon using Obsidian API for Lucide, text for emoji
  useEffect(() => {
    if (!iconRef.current || !icon.value) {
      // Clear if icon is removed
      if (iconRef.current) {
        iconRef.current.innerHTML = '';
      }
      previousIconTypeRef.current = null;
      return;
    }

    const iconValue = icon.value;
    const isLucide = iconValue.startsWith("Li");
    const currentIconType = isLucide ? 'lucide' : 'emoji';

    // Clear content when switching between icon types or when icon changes
    if (previousIconTypeRef.current !== null && previousIconTypeRef.current !== currentIconType) {
      iconRef.current.innerHTML = '';
    }

    // Handle Lucide icons
    if (isLucide) {
      // Remove "Li" prefix and convert PascalCase to kebab-case
      // e.g., "LiAlarmClockCheck" -> "alarm-clock-check"
      const pascalCase = iconValue.substring(2);
      const kebabCase = pascalCase.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
      // Use Obsidian's setIcon to render Lucide icon
      setIcon(iconRef.current, kebabCase as any);
    } else {
      // Handle emoji - set as text content
      iconRef.current.textContent = iconValue;
    }

    previousIconTypeRef.current = currentIconType;
  }, [icon.value]);

  if (!icon.value) {
    return null;
  }

  const iconValue = icon.value;
  const isLucide = iconValue.startsWith("Li");

  // Use single element for both icon types
  return (
    <span
      ref={iconRef}
      class={`iconize-icon ${isLucide ? "lucide-icon" : ""} ${className}`.trim()}
      aria-label={iconValue}
      style={{ marginRight: "0.3em", display: "inline-block" }}
    />
  );
}

