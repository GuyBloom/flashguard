// Popup UI. SPEC.md §6.2.
//
// Functional but plain — this isn't the Figma-matched visual design yet
// (that's still build order step 6 polish), just real controls wired to
// real settings and a real status line, so there's something to test.

import type { GetStatusRequest, StatusResponse } from "../shared/messages";
import { isHostAllowed, type InterventionMode, type Settings, getSettings, onSettingsChanged, setSettings } from "../shared/settings";
import type { Sensitivity } from "../detection/types";

const MODES: { value: InterventionMode; label: string }[] = [
  { value: "blur", label: "Blur" },
  { value: "dim", label: "Dim" },
  { value: "freeze", label: "Freeze" },
];
const SENSITIVITIES: { value: Sensitivity; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "balanced", label: "Balanced" },
  { value: "high", label: "High" },
];

async function queryActiveTabStatus(): Promise<StatusResponse | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return null;
    const request: GetStatusRequest = { type: "flashguard:get-status" };
    const response = await chrome.tabs.sendMessage(tab.id, request);
    return (response as StatusResponse) ?? null;
  } catch {
    return null; // no content script on this page (chrome://, not yet loaded, etc.)
  }
}

function statusText(settings: Settings, status: StatusResponse | null): string {
  if (!settings.enabled) return "Protection is off.";
  if (!status) return "Status unavailable on this page.";
  if (isHostAllowed(settings, status.hostname)) return `Protection is off for ${status.hostname}.`;
  const { intervening, unanalyzable } = status.videosByState;
  if (intervening > 0) return `${intervening} video${intervening === 1 ? "" : "s"} hidden on this page.`;
  if (unanalyzable > 0) return `${unanalyzable} video${unanalyzable === 1 ? "" : "s"} can't be checked.`;
  return "No flashing detected.";
}

async function render(): Promise<void> {
  const app = document.getElementById("app");
  if (!app) return;

  const [settings, status] = await Promise.all([getSettings(), queryActiveTabStatus()]);
  const update = (patch: Partial<Settings>) => setSettings({ ...settings, ...patch }).then(render);

  // Keep the <h1> from the HTML shell; replace everything after it.
  for (const node of [...app.children].slice(1)) node.remove();

  const toggle = document.createElement("button");
  toggle.textContent = `Protection: ${settings.enabled ? "On" : "Off"}`;
  toggle.addEventListener("click", () => update({ enabled: !settings.enabled }));
  app.appendChild(toggle);

  const status_p = document.createElement("p");
  status_p.textContent = statusText(settings, status);
  app.appendChild(status_p);

  if (status) {
    const allowed = isHostAllowed(settings, status.hostname);
    const siteToggle = document.createElement("button");
    siteToggle.textContent = allowed ? `Restore protection on ${status.hostname}` : `Allow on ${status.hostname}`;
    siteToggle.addEventListener("click", () =>
      update({
        allowedHosts: allowed
          ? settings.allowedHosts.filter((h) => h !== status.hostname)
          : [...settings.allowedHosts, status.hostname],
      }),
    );
    app.appendChild(siteToggle);
  }

  const modeLabel = document.createElement("p");
  modeLabel.textContent = "Intervention mode:";
  app.appendChild(modeLabel);
  const modeRow = document.createElement("div");
  for (const { value, label } of MODES) {
    const button = document.createElement("button");
    button.textContent = settings.mode === value ? `[${label}]` : label;
    button.addEventListener("click", () => update({ mode: value }));
    modeRow.appendChild(button);
  }
  app.appendChild(modeRow);

  const sensLabel = document.createElement("p");
  sensLabel.textContent = "Sensitivity:";
  app.appendChild(sensLabel);
  const sensRow = document.createElement("div");
  for (const { value, label } of SENSITIVITIES) {
    const button = document.createElement("button");
    button.textContent = settings.sensitivity === value ? `[${label}]` : label;
    button.addEventListener("click", () => update({ sensitivity: value }));
    sensRow.appendChild(button);
  }
  app.appendChild(sensRow);

  const hudLabel = document.createElement("label");
  const hudCheckbox = document.createElement("input");
  hudCheckbox.type = "checkbox";
  hudCheckbox.checked = settings.debugHud;
  hudCheckbox.addEventListener("change", () => update({ debugHud: hudCheckbox.checked }));
  hudLabel.append(hudCheckbox, " Debug HUD (dev)");
  app.appendChild(hudLabel);

  const optionsLink = document.createElement("button");
  optionsLink.textContent = "More settings…";
  optionsLink.addEventListener("click", () => chrome.runtime.openOptionsPage());
  app.appendChild(optionsLink);
}

render().catch((error: unknown) => {
  console.error("[FlashGuard] popup failed to initialize", error);
});

onSettingsChanged(() => {
  render().catch((error: unknown) => {
    console.error("[FlashGuard] popup failed to re-render", error);
  });
});
