// Options page. SPEC.md §6.3.
//
// Functional but plain — real controls on real settings, visual design
// parity with the Figma prototype is still build order step 6.

import type { Sensitivity } from "../detection/types";
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

async function render(): Promise<void> {
  const app = document.getElementById("app");
  if (!app) return;

  const settings = await getSettings();
  const update = (patch: Partial<Settings>) => setSettings({ ...settings, ...patch }).then(render);

  // Keep the <h1> from the HTML shell; replace everything after it.
  for (const node of [...app.children].slice(1)) node.remove();

  const modeSection = document.createElement("section");
  modeSection.innerHTML = "<h2>Default intervention behavior</h2>";
  const modeRow = document.createElement("div");
  for (const { value, label } of MODES) {
    const button = document.createElement("button");
    button.textContent = settings.mode === value ? `[${label}]` : label;
    button.addEventListener("click", () => update({ mode: value }));
    modeRow.appendChild(button);
  }
  modeSection.appendChild(modeRow);
  app.appendChild(modeSection);

  const sensSection = document.createElement("section");
  sensSection.innerHTML = "<h2>Default sensitivity</h2>";
  const sensRow = document.createElement("div");
  for (const { value, label } of SENSITIVITIES) {
    const button = document.createElement("button");
    button.textContent = settings.sensitivity === value ? `[${label}]` : label;
    button.addEventListener("click", () => update({ sensitivity: value }));
    sensRow.appendChild(button);
  }
  sensSection.appendChild(sensRow);
  app.appendChild(sensSection);

  const whitelistSection = document.createElement("section");
  whitelistSection.innerHTML = `<h2>Website exceptions (${settings.allowedHosts.length})</h2>`;
  if (settings.allowedHosts.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No saved exceptions.";
    whitelistSection.appendChild(empty);
  } else {
    const list = document.createElement("ul");
    for (const host of settings.allowedHosts) {
      const item = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = `${host} `;
      const remove = document.createElement("button");
      remove.textContent = "Remove";
      remove.addEventListener("click", () => update({ allowedHosts: settings.allowedHosts.filter((h) => h !== host) }));
      item.append(name, remove);
      list.appendChild(item);
    }
    whitelistSection.appendChild(list);
  }
  app.appendChild(whitelistSection);

  const advanced = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "Advanced";
  advanced.appendChild(summary);
  const hudLabel = document.createElement("label");
  const hudCheckbox = document.createElement("input");
  hudCheckbox.type = "checkbox";
  hudCheckbox.checked = settings.debugHud;
  hudCheckbox.addEventListener("change", () => update({ debugHud: hudCheckbox.checked }));
  hudLabel.append(hudCheckbox, " Developer: Debug HUD");
  advanced.appendChild(hudLabel);
  app.appendChild(advanced);

  const about = document.createElement("section");
  about.innerHTML = `
    <h2>About &amp; limitations</h2>
    <p>FlashGuard is not a medical device. It reduces risk based on the
    WCAG 2.3.1 "Three Flashes or Below Threshold" thresholds, not a clinical
    standard. It cannot check every video (cross-origin DRM-protected frames,
    for example) and cannot guarantee protection even for the video it can
    check.</p>
  `;
  app.appendChild(about);
}

render().catch((error: unknown) => {
  console.error("[FlashGuard] options page failed to initialize", error);
});
