import { CSS_CLASSES, MODAL_LABELS } from "../../constants";

interface LoadingIndicatorProps {
  isActive: boolean;
}

/**
 * Loading indicator component
 */
export function LoadingIndicator({ isActive }: LoadingIndicatorProps) {
  return (
    <div class={`${CSS_CLASSES.LOADING}${isActive ? ` ${CSS_CLASSES.LOADING_ACTIVE}` : ""}`}>
      <div class={CSS_CLASSES.LOADING_DOT} />
      <span>{MODAL_LABELS.UPDATING}</span>
    </div>
  );
}

