// Settings storage. SPEC.md §7.
//
// Uses chrome.storage.local, NEVER sync — syncing would send whitelisted
// hostnames (browsing data) to a Google account (CLAUDE.md "Non-negotiables").

import type { Sensitivity } from "../detection/types";
import { DEFAULT_SENSITIVITY } from "../detection/config";

/** Branded "Blur" / "Dim" / "Freeze" in the UI. SPEC.md §6.1. */
export type InterventionMode = "blur" | "dim" | "freeze";

export interface Settings {
  version: 1;
  enabled: boolean;
  sensitivity: Sensitivity;
  mode: InterventionMode;
  allowedHosts: string[];
  debugHud: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  enabled: true,
  sensitivity: DEFAULT_SENSITIVITY,
  mode: "blur", // [OPEN] SPEC.md §6.1
  allowedHosts: [],
  debugHud: false,
};

const STORAGE_KEY = "settings";

/** Validates and migrates stored data; unknown or corrupt data falls back to defaults. SPEC.md §7. */
export function parseSettings(value: unknown): Settings {
  if (typeof value !== "object" || value === null) return { ...DEFAULT_SETTINGS };

  const v = value as Partial<Settings>;
  const sensitivity: Sensitivity =
    v.sensitivity === "low" || v.sensitivity === "balanced" || v.sensitivity === "high"
      ? v.sensitivity
      : DEFAULT_SETTINGS.sensitivity;
  const mode: InterventionMode =
    v.mode === "blur" || v.mode === "dim" || v.mode === "freeze" ? v.mode : DEFAULT_SETTINGS.mode;

  return {
    version: 1,
    enabled: typeof v.enabled === "boolean" ? v.enabled : DEFAULT_SETTINGS.enabled,
    sensitivity,
    mode,
    allowedHosts: Array.isArray(v.allowedHosts) ? v.allowedHosts.filter((h) => typeof h === "string") : [],
    debugHud: typeof v.debugHud === "boolean" ? v.debugHud : DEFAULT_SETTINGS.debugHud,
  };
}

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return parseSettings(stored[STORAGE_KEY]);
}

export async function setSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
}

export function onSettingsChanged(callback: (settings: Settings) => void): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !(STORAGE_KEY in changes)) return;
    callback(parseSettings(changes[STORAGE_KEY]?.newValue));
  });
}

export function isHostAllowed(settings: Settings, hostname: string): boolean {
  return settings.allowedHosts.includes(hostname);
}

/** Adds `hostname` to the whitelist, if it isn't already there. "Always allow on this site". SPEC.md §6.1. */
export async function allowHost(hostname: string): Promise<void> {
  const settings = await getSettings();
  if (isHostAllowed(settings, hostname)) return;
  await setSettings({ ...settings, allowedHosts: [...settings.allowedHosts, hostname] });
}
