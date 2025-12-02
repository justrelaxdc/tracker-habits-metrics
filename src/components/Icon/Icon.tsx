import { useComputed } from "@preact/signals";
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
  // Get icon reactively from store
  const icon = useComputed(() => trackerStore.getIcon(path));

  if (!icon.value) {
    return null;
  }

  const iconValue = icon.value;

  // Check if it's a Lucide icon (starts with "Li")
  if (iconValue.startsWith("Li")) {
    return (
      <span
        class={`iconize-icon lucide-icon ${className}`.trim()}
        data-icon={iconValue}
        aria-label={iconValue}
        style={{ marginRight: "0.3em", display: "inline-block" }}
      />
    );
  }

  // Emoji icon
  return (
    <span
      class={className || undefined}
      style={{ marginRight: "0.3em" }}
    >
      {iconValue}
    </span>
  );
}

