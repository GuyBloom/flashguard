// Options page. SPEC.md §6.3. Visual language borrowed from figma-project
// (../shared/theme.css + ../shared/icons.ts).

import type { Sensitivity } from "../detection/types";
import { icon } from "../shared/icons";
import { getSettings, type InterventionMode, type Settings, setSettings } from "../shared/settings";

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

function section(kickerText: string): HTMLElement {
  const el = document.createElement("section");
  const kicker = document.createElement("span");
  kicker.className = "section-kicker";
  kicker.textContent = kickerText;
  el.appendChild(kicker);
  return el;
}

async function render(): Promise<void> {
  const app = document.getElementById("app");
  if (!app) return;

  const settings = await getSettings();
  const update = (patch: Partial<Settings>) => setSettings({ ...settings, ...patch }).then(render);

  app.replaceChildren();

  const header = document.createElement("div");
  header.className = "options-header";
  const logo = document.createElement("div");
  logo.className = "logo-box";
  logo.appendChild(icon("shield", 20));
  const h1 = document.createElement("h1");
  h1.textContent = "FlashGuard Settings";
  header.append(logo, h1);
  app.appendChild(header);

  // --- defaults: mode -------------------------------------------------------
  const modeSection = section("DEFAULT INTERVENTION BEHAVIOR");
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
  modeSection.appendChild(modeOptions);
  app.appendChild(modeSection);

  // --- defaults: sensitivity --------------------------------------------------
  const sensSection = section("DEFAULT SENSITIVITY");
  const sensOptions = document.createElement("div");
  sensOptions.className = "mode-options";
  for (const { value, label } of SENSITIVITIES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = settings.sensitivity === value ? "selected" : "";
    button.textContent = label;
    button.addEventListener("click", () => update({ sensitivity: value }));
    sensOptions.appendChild(button);
  }
  sensSection.appendChild(sensOptions);
  app.appendChild(sensSection);

  // --- website exceptions ------------------------------------------------------
  const whitelistSection = section(`WEBSITE EXCEPTIONS · ${settings.allowedHosts.length}`);
  if (settings.allowedHosts.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.appendChild(icon("globe", 22));
    const strong = document.createElement("strong");
    strong.textContent = "No saved exceptions";
    const p = document.createElement("p");
    p.textContent = "Websites you trust will appear here.";
    empty.append(strong, p);
    whitelistSection.appendChild(empty);
  } else {
    const list = document.createElement("ul");
    list.className = "exception-list";
    for (const host of settings.allowedHosts) {
      const item = document.createElement("li");
      const name = document.createElement("span");
      name.append(icon("globe", 14), ` ${host}`);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "button button--ghost";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => update({ allowedHosts: settings.allowedHosts.filter((h) => h !== host) }));
      item.append(name, remove);
      list.appendChild(item);
    }
    whitelistSection.appendChild(list);
  }
  app.appendChild(whitelistSection);

  // --- advanced: debug HUD ---------------------------------------------------
  const advanced = document.createElement("details");
  advanced.open = settings.debugHud;
  const summary = document.createElement("summary");
  summary.textContent = "Advanced";
  const hudLabel = document.createElement("label");
  const hudCheckbox = document.createElement("input");
  hudCheckbox.type = "checkbox";
  hudCheckbox.checked = settings.debugHud;
  hudCheckbox.addEventListener("change", () => update({ debugHud: hudCheckbox.checked }));
  hudLabel.append(hudCheckbox, "Developer: Debug HUD");
  advanced.append(summary, hudLabel);
  app.appendChild(advanced);

  // --- about & limitations ------------------------------------------------------
  const about = document.createElement("section");
  about.className = "about-section";
  const aboutTitle = document.createElement("h2");
  aboutTitle.textContent = "About & limitations";
  const aboutBody = document.createElement("p");
  aboutBody.textContent =
    "FlashGuard is not a medical device. It reduces risk based on the WCAG 2.3.1 “Three Flashes or Below Threshold” thresholds, not a clinical standard. It cannot check every video (cross-origin DRM-protected frames, for example) and cannot guarantee protection even for the video it can check.";
  about.append(aboutTitle, aboutBody);
  app.appendChild(about);
}

render().catch((error: unknown) => {
  console.error("[FlashGuard] options page failed to initialize", error);
});
