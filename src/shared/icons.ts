// Small inline-SVG icon set shared by popup.ts/options.ts, paths borrowed
// from figma-project's Icon component for visual consistency with the
// Figma prototype.

export type IconName = "shield" | "check" | "warning" | "globe" | "chevron" | "refresh";

const PATHS: Record<IconName, string> = {
  shield: "M12 2.5 4.5 5.8v5.1c0 4.7 3.2 8.9 7.5 10.6 4.3-1.7 7.5-5.9 7.5-10.6V5.8L12 2.5Zm0 3 4.5 2v3.4c0 3.1-1.8 6.1-4.5 7.5-2.7-1.4-4.5-4.4-4.5-7.5V7.5l4.5-2Z",
  check: "m5 12 4 4L19 6",
  warning: "M12 3 2.8 20h18.4L12 3Z M12 9v5M12 17h.01",
  globe: "M3 12h18M12 3c2.3 2.5 3.5 5.5 3.5 9S14.3 18.5 12 21c-2.3-2.5-3.5-5.5-3.5-9S9.7 5.5 12 3Z",
  chevron: "m9 18 6-6-6-6",
  refresh: "M20 7v5h-5M4 17v-5h5M18.5 9A7 7 0 0 0 6.2 6.2L4 9m16 6-2.2 2.8A7 7 0 0 1 5.5 15",
};

const SVG_NS = "http://www.w3.org/2000/svg";

export function icon(name: IconName, size = 16): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "icon");
  svg.setAttribute("fill", name === "shield" ? "currentColor" : "none");

  const g = document.createElementNS(SVG_NS, "g");
  g.setAttribute("stroke", "currentColor");
  g.setAttribute("stroke-width", "1.8");
  g.setAttribute("stroke-linecap", "round");
  g.setAttribute("stroke-linejoin", "round");

  if (name === "globe") {
    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("cx", "12");
    circle.setAttribute("cy", "12");
    circle.setAttribute("r", "9");
    g.appendChild(circle);
  }

  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", PATHS[name]);
  g.appendChild(path);
  svg.appendChild(g);
  return svg;
}
