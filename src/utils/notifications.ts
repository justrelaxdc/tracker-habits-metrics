import { Notice } from "obsidian";
import { MOBILE_BREAKPOINT } from "../constants";

/**
 * Shows notification only on desktop
 * On mobile devices, data recording notifications are hidden
 * to avoid cluttering the interface
 */
export function showNoticeIfNotMobile(message: string, timeout?: number): void {
  if (window.innerWidth > MOBILE_BREAKPOINT) {
    new Notice(message, timeout);
  }
}

