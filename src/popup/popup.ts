// Popup UI. SPEC.md §6.2. Visual language borrowed from figma-project
// (../shared/theme.css + ../shared/icons.ts) so this looks like the
// intended design, not a bare functional placeholder.

import type { Sensitivity } from "../detection/types";
import { icon } from "../shared/icons";
import type { GetStatusRequest, StatusResponse } from "../shared/messages";
import { isHostAllowed, type InterventionMode, type Settings, getSettings, onSettingsChanged, setSettings } from "../shared/settings";

const MODES: { value: InterventionMode; label: string }[] = [
  { value: "blur", label: "Blur" },
  { value: "dim", label: "Dim" },
  { value: "freeze", label: "Freeze" },
];
const SENSITIVITIES: Sensitivity[] = ["low", "balanced", "high"];

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

function toggle(checked: boolean, label: string, onChange: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.role = "switch";
  button.className = `toggle${checked ? " toggle--on" : ""}`;
  button.setAttribute("aria-checked", String(checked));
  button.setAttribute("aria-label", label);
  button.appendChild(document.createElement("span"));
  button.addEventListener("click", onChange);
  return button;
}

function statusBadge(type: "active" | "off", text: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = `status status--${type}`;
  span.textContent = text;
  return span;
}

async function render(): Promise<void> {
  const app = document.getElementById("app");
  if (!app) return;

  const [settings, status] = await Promise.all([getSettings(), queryActiveTabStatus()]);
  const update = (patch: Partial<Settings>) => setSettings({ ...settings, ...patch }).then(render);

  app.replaceChildren();

  // --- header -----------------------------------------------------------
  const header = document.createElement("header");
  header.className = "popup-header";
  const logo = document.createElement("div");
  logo.className = "logo-box";
  logo.appendChild(icon("shield", 19));
  const brand = document.createElement("div");
  brand.className = "popup-brand";
  const brandName = document.createElement("strong");
  brandName.textContent = "FlashGuard";
  const brandSub = document.createElement("span");
  brandSub.textContent = "Flash protection for your browser.";
  brand.append(brandName, brandSub);
  header.append(logo, brand);
  app.appendChild(header);

  const body = document.createElement("div");
  body.className = "popup-body";
  app.appendChild(body);

  // --- protection card ----------------------------------------------------
  const protectionCard = document.createElement("section");
  protectionCard.className = `protection-card${settings.enabled ? "" : " protection-card--off"}`;
  const protectionHeading = document.createElement("div");
  const protectionKicker = document.createElement("span");
  protectionKicker.className = "section-kicker";
  protectionKicker.textContent = "PRIMARY CONTROL";
  const protectionTitle = document.createElement("h2");
  protectionTitle.textContent = "FlashGuard Protection";
  protectionHeading.append(protectionKicker, protectionTitle);
  const protectionToggle = toggle(settings.enabled, "Toggle FlashGuard protection", () => update({ enabled: !settings.enabled }));
  const protectionNote = document.createElement("p");
  protectionNote.appendChild(icon(settings.enabled ? "check" : "warning", 14));
  protectionNote.append(settings.enabled ? "Protection is active." : "Protection is off. Flashing content will not be filtered.");
  protectionCard.append(protectionHeading, protectionToggle, protectionNote);
  body.appendChild(protectionCard);

  // --- current site -------------------------------------------------------
  if (status) {
    const allowed = isHostAllowed(settings, status.hostname);
    const siteCard = document.createElement("section");
    siteCard.className = "site-card";
    const siteHeader = document.createElement("div");
    siteHeader.className = "row-between";
    const siteLeft = document.createElement("div");
    const siteKicker = document.createElement("span");
    siteKicker.className = "section-kicker";
    siteKicker.textContent = "CURRENT WEBSITE";
    const siteName = document.createElement("strong");
    siteName.textContent = status.hostname;
    siteLeft.append(siteKicker, siteName);
    siteHeader.append(siteLeft, statusBadge(allowed ? "off" : settings.enabled ? "active" : "off", allowed ? "Excluded" : settings.enabled ? "Protected" : "Off"));
    const sitePara = document.createElement("p");
    sitePara.textContent = allowed
      ? "Protection is disabled on this website because you added it to your whitelist."
      : "FlashGuard is active on this website.";
    const siteButton = document.createElement("button");
    siteButton.type = "button";
    siteButton.className = "button full-width";
    siteButton.textContent = allowed ? "Restore protection" : "Trust this site";
    siteButton.addEventListener("click", () =>
      update({
        allowedHosts: allowed
          ? settings.allowedHosts.filter((h) => h !== status.hostname)
          : [...settings.allowedHosts, status.hostname],
      }),
    );
    siteCard.append(siteHeader, sitePara, siteButton);
    body.appendChild(siteCard);
  }

  // --- overall status row --------------------------------------------------
  const statusRow = document.createElement("div");
  statusRow.className = "settings-toggle";
  const statusLeft = document.createElement("span");
  statusLeft.className = "section-kicker";
  statusLeft.textContent = "STATUS";
  const statusRight = document.createElement("strong");
  statusRight.style.fontSize = "11px";
  statusRight.textContent = statusText(settings, status);
  statusRow.append(statusLeft, statusRight);
  body.appendChild(statusRow);

  // --- intervention mode ---------------------------------------------------
  const modeSection = document.createElement("section");
  const modeKicker = document.createElement("span");
  modeKicker.className = "section-kicker";
  modeKicker.textContent = "INTERVENTION MODE";
  const modeOptions = document.createElement("div");
  modeOptions.className = "mode-options";
  for (const { value, label } of MODES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = settings.mode === value ? "selected" : "";
    button.textContent = label;
    button.addEventListener("click", () => update({ mode: value }));
    modeOptions.appendChild(button);
  }
  modeSection.append(modeKicker, modeOptions);
  body.appendChild(modeSection);

  // --- sensitivity -----------------------------------------------------------
  const sensSection = document.createElement("section");
  const sensKicker = document.createElement("span");
  sensKicker.className = "section-kicker";
  sensKicker.textContent = "SENSITIVITY";
  const sensInput = document.createElement("input");
  sensInput.type = "range";
  sensInput.className = "sensitivity";
  sensInput.min = "0";
  sensInput.max = "2";
  sensInput.step = "1";
  sensInput.value = String(SENSITIVITIES.indexOf(settings.sensitivity));
  sensInput.setAttribute("aria-label", "Detection sensitivity");
  sensInput.addEventListener("change", () => {
    const next = SENSITIVITIES[Number(sensInput.value)];
    if (next) update({ sensitivity: next });
  });
  const sensLabels = document.createElement("div");
  sensLabels.className = "range-labels";
  sensLabels.innerHTML = "<span>Low</span><span>Balanced</span><span>High</span>";
  sensSection.append(sensKicker, sensInput, sensLabels);
  body.appendChild(sensSection);

  // --- debug HUD -------------------------------------------------------------
  const hudRow = document.createElement("div");
  hudRow.className = "settings-toggle";
  const hudText = document.createElement("div");
  const hudStrong = document.createElement("strong");
  hudStrong.textContent = "Debug HUD";
  const hudHelper = document.createElement("p");
  hudHelper.className = "helper";
  hudHelper.textContent = "Shows live fps, grid, and flash stats on analyzed video.";
  hudText.append(hudStrong, hudHelper);
  const hudToggle = toggle(settings.debugHud, "Toggle debug HUD", () => update({ debugHud: !settings.debugHud }));
  hudRow.append(hudText, hudToggle);
  body.appendChild(hudRow);

  // --- more settings link -----------------------------------------------------
  const optionsLink = document.createElement("button");
  optionsLink.type = "button";
  optionsLink.className = "settings-link";
  optionsLink.append("More settings");
  optionsLink.appendChild(icon("chevron", 14));
  optionsLink.addEventListener("click", () => chrome.runtime.openOptionsPage());
  body.appendChild(optionsLink);

  // --- footer -----------------------------------------------------------------
  const footer = document.createElement("footer");
  footer.className = "popup-footer";
  footer.innerHTML = "<span>FlashGuard v0.1.0</span><span>WCAG 2.3.1-based</span>";
  app.appendChild(footer);
}

render().catch((error: unknown) => {
  console.error("[FlashGuard] popup failed to initialize", error);
});

onSettingsChanged(() => {
  render().catch((error: unknown) => {
    console.error("[FlashGuard] popup failed to re-render", error);
  });
});
