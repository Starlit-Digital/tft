import { defaults, getPreferences } from "./preferences.js?v=sdou20261029b";
export const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const icons = {
  gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 3-.5 2.2-2 .9-2-.5L3 8.4 4.6 10l-.2 2.3L2.8 14 4.3 17l2.3-.4 1.7 1.2.5 2.2h3l.7-2.1 2-.9 2 .5 1.5-2.7-1.5-1.6.2-2.3 1.7-1.8L17 6.3l-2.3.4-1.7-1.2L12.4 3Z"/><circle cx="10.4" cy="11.6" r="3"/></svg>',
  close:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
};
export const range = (key, label, min, max, step, ends = ["Less", "More"]) =>
  `<div class="control"><div class="control-head"><label for="${key}">${label}</label><output for="${key}" data-output="${key}" aria-live="off"></output></div><input data-pref="${key}" id="${key}" type="range" min="${min}" max="${max}" step="${step}"><div class="endpoints" aria-hidden="true"><span>${ends[0]}</span><span>${ends[1]}</span></div></div>`;
export const select = (key, label, options) =>
  `<div class="control"><label for="${key}" class="field-label">${label}</label><select id="${key}" data-pref="${key}" aria-describedby="${key}-hint">${options.map(([value, text]) => `<option value="${value}">${text}</option>`).join("")}</select><p class="hint" id="${key}-hint">${{ theme: "System follows your device appearance.", font: "Choose the typeface that feels comfortable to you.", motion: "Your device setting is always respected.", contrast: "Color pairs keep at least 5:1 contrast.", align: "Start follows the page writing direction.", guide: "Use the position slider or move a pointer over the reading area." }[key] || "Changes apply to the reading preview."}</p></div>`;
export const toggle = (key, title, help) =>
  `<label class="toggle" for="${key}"><span class="toggle-copy"><strong>${title}</strong><small id="${key}-hint">${help}</small></span><input type="checkbox" role="switch" id="${key}" data-pref="${key}" aria-describedby="${key}-hint"></label>`;
export const group = (title, content, open = false) =>
  `<details${open ? " open" : ""}><summary>${title}</summary><div class="group-body">${content}</div></details>`;
export const preview =
  '<div class="preview" data-preview><small>Live reading preview</small><p>Software with purpose. Made for people, with room for the details that matter.</p></div>';
export const typography = () =>
  range("size", "Text size", 1, 2, 0.05, ["100%", "200%"]) +
  range("leading", "Line spacing", 1.5, 2.5, 0.05, [
    "Comfortable",
    "Spacious",
  ]) +
  range("letter", "Letter spacing", 0, 0.16, 0.01, ["Standard", "Wider"]) +
  range("word", "Word spacing", 0, 0.3, 0.02, ["Standard", "Wider"]) +
  range("paragraph", "Paragraph spacing", 1, 2.5, 0.25, [
    "Standard",
    "Spacious",
  ]) +
  range("measure", "Line length", 40, 85, 1, ["Narrow", "Wide"]) +
  select("font", "Text style", [
    ["studio", "Studio serif"],
    ["sans", "Simple sans serif"],
    ["serif", "Georgia serif"],
    ["mono", "Monospace"],
  ]) +
  select("align", "Alignment", [
    ["start", "Follow writing direction"],
    ["left", "Align left"],
  ]);
export const appearance = () =>
  select("theme", "Appearance", [
    ["system", "Use device setting"],
    ["dark", "Starlit dark"],
    ["light", "Starlit light"],
    ["warm", "Warm paper"],
  ]) +
  range("brightness", "Page shade", 0, 31, 1, ["Dark", "Light"]) +
  select("contrast", "Contrast", [
    ["standard", "Starlit palette, at least 5:1"],
    ["high", "High contrast"],
  ]) +
  toggle(
    "links",
    "Emphasize links",
    "Underline and outline links in the reading area.",
  ) +
  toggle(
    "headings",
    "Emphasize headings",
    "Add a visible marker beside each heading.",
  );
export const motion = () =>
  select("motion", "Motion", [
    ["system", "Use device setting"],
    ["reduce", "Reduce motion"],
  ]) +
  toggle(
    "hideDecorative",
    "Hide decorative images",
    "Keep informative images and their descriptions available.",
  ) +
  toggle(
    "captions",
    "Show available captions",
    "Use authored captions where the page provides a track.",
  );
export const focus = () =>
  select("guide", "Reading guide", [
    ["off", "Off"],
    ["line", "Reading line"],
    ["mask", "Focus strip"],
  ]) +
  range("guidePosition", "Guide position", 5, 95, 1, ["Top", "Bottom"]) +
  toggle(
    "focus",
    "Emphasize focus",
    "Keep a strong outline around the active control.",
  ) +
  toggle(
    "cursor",
    "Larger pointer",
    "Use a larger arrow within the reading area.",
  );
const describe = (key, value) =>
  ({
    size: () => Math.round(value * 100) + "%",
    brightness: () =>
      value === null
        ? "Using appearance"
        : `Shade ${Math.round(value) + 1} of 32`,
    leading: () => Number(value).toFixed(2) + " ×",
    letter: () => Number(value).toFixed(2) + " em",
    word: () => Number(value).toFixed(2) + " em",
    paragraph: () => Number(value).toFixed(2) + " em",
    measure: () => Math.round(value) + " characters",
    guidePosition: () => Math.round(value) + "%",
    volume: () => Math.round(value * 100) + "%",
    rate: () => Number(value).toFixed(1) + " ×",
  })[key]?.() ?? String(value);
export class A11yComponent extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }
  connectedCallback() {
    this.abort = new AbortController();
    try {
      this.target = document.querySelector(
        this.getAttribute("target") || "[data-sdou-a11y-content]",
      );
      this.preferences = getPreferences(
        this.target,
        this.getAttribute("storage-key") || "starlit.a11y.v1",
      );
      this.preferences.refs = (this.preferences.refs || 0) + 1;
      this.render();
      this.bind();
      this.sync();
      this.initialize?.();
      this.sync();
    } catch (error) {
      this.shadowRoot.innerHTML = `<p role="status">${escape(error.message)}</p>`;
    }
  }
  disconnectedCallback() {
    this.abort?.abort();
    this.cleanup?.();
    if (this.listener)
      this.preferences?.removeEventListener("change", this.listener);
    if (this.preferences) {
      this.preferences.refs--;
      if (this.preferences.refs === 0) this.preferences.dispose?.();
    }
  }
  on(element, event, handler) {
    element?.addEventListener(event, handler, { signal: this.abort.signal });
  }
  q(selector) {
    return this.shadowRoot.querySelector(selector);
  }
  qa(selector) {
    return [...this.shadowRoot.querySelectorAll(selector)];
  }
  mount(
    title,
    description,
    content,
    {
      dialog = false,
      launcher = "Accessibility preferences",
      reset = true,
    } = {},
  ) {
    const shared = new URL("./ui.css?v=sdou20261029b", import.meta.url).href,
      own = this.constructor.styles;
    const links =
      `<link rel="stylesheet" href="${shared}">` +
      (own ? `<link rel="stylesheet" href="${own}">` : "");
    const footer = `<div class="panel-footer">${reset ? '<button type="button" class="button secondary" data-reset>Reset these preferences</button>' : ""}<p class="status" role="status" aria-live="polite" aria-atomic="true" data-status></p><p class="error" role="alert" aria-atomic="true" data-error></p><p class="storage-note" data-storage>Preferences stay on this device.</p></div>`;
    this.dialogMode = dialog;
    this.shadowRoot.innerHTML =
      links +
      (dialog
        ? `<button type="button" class="button launcher" aria-haspopup="dialog" aria-controls="preferences" aria-expanded="false" data-open>${icons.gear}<span>${launcher}</span></button><dialog id="preferences" aria-labelledby="component-title" aria-describedby="component-description"><header class="dialog-head"><div><span class="kicker">Starlit / Your reading space</span><h2 id="component-title" tabindex="-1" class="dialog-title">${title}</h2><p id="component-description">${description}</p></div><button type="button" class="button icon secondary" data-close aria-label="Close ${escape(title.toLowerCase())}">${icons.close}</button></header><div class="panel-body">${content}</div>${footer}</dialog>`
        : `<section class="panel" aria-labelledby="component-title"><header class="panel-head"><span class="kicker">Starlit / Your reading space</span><h2 id="component-title">${title}</h2><p id="component-description">${description}</p></header><div class="panel-body">${content}</div>${footer}</section>`);
  }
  bind() {
    this.listener = () => this.sync();
    this.preferences.addEventListener("change", this.listener);
    this.on(this.shadowRoot, "input", (event) => {
      const input = event.target,
        key = input.dataset.pref;
      if (!key) return;
      let value =
        input.type === "checkbox"
          ? input.checked
          : input.type === "range"
            ? Number(input.value)
            : input.value;
      const patch = { [key]: value };
      if (key === "theme") patch.brightness = null;
      this.preferences.set(patch);
    });
    this.on(this.q("[data-reset]"), "click", () => {
      const keys = [
        ...new Set(this.qa("[data-pref]").map((x) => x.dataset.pref)),
      ];
      if (this.resetAll) this.preferences.reset();
      else
        this.preferences.set(
          Object.fromEntries(keys.map((key) => [key, defaults[key]])),
        );
      this.say("These preferences have been reset.");
    });
    if (this.dialogMode) {
      const dialog = this.q("dialog"),
        button = this.q("[data-open]");
      this.on(button, "click", () => this.open());
      this.on(this.q("[data-close]"), "click", () => dialog.close());
      this.on(dialog, "close", () => {
        button.setAttribute("aria-expanded", "false");
        if (button.isConnected) button.focus();
      });
      this.on(dialog, "click", (event) => {
        const r = dialog.getBoundingClientRect();
        if (
          event.target === dialog &&
          (event.clientX < r.left ||
            event.clientX > r.right ||
            event.clientY < r.top ||
            event.clientY > r.bottom)
        )
          dialog.close();
      });
      this.on(dialog, "keydown", (event) => {
        if (event.key !== "Tab") return;
        const items = [
          ...dialog.querySelectorAll(
            'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])',
          ),
        ].filter((el) => el.getClientRects().length);
        if (!items.length) {
          event.preventDefault();
          dialog.focus();
          return;
        }
        const first = items[0],
          last = items.at(-1),
          active = this.shadowRoot.activeElement;
        if (event.shiftKey && (active === first || !items.includes(active))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      });
    }
  }
  open() {
    const dialog = this.q("dialog");
    if (!dialog || dialog.open) return;
    dialog.showModal();
    this.q("[data-open]").setAttribute("aria-expanded", "true");
    this.q("#component-title").focus();
  }
  sync() {
    if (!this.preferences) return;
    const s = this.preferences.state;
    for (const input of this.qa("[data-pref]")) {
      const value = s[input.dataset.pref];
      if (input.type === "checkbox") input.checked = value;
      else
        input.value =
          value === null ? (this.preferences.colors.dark ? "0" : "31") : value;
      if (input.type === "range")
        input.setAttribute(
          "aria-valuetext",
          describe(input.dataset.pref, value),
        );
    }
    for (const output of this.qa("[data-output]"))
      output.value = describe(output.dataset.output, s[output.dataset.output]);
    for (const sample of this.qa("[data-preview]")) {
      for (const key of ["page", "text", "line"])
        sample.style.setProperty("--sdou-a11y-" + key, this.preferences.colors[key]);
      for (const key of ["scale", "leading", "letter", "word", "font"])
        sample.style.setProperty(
          "--sdou-a11y-" + key,
          this.target.style.getPropertyValue("--sdou-a11y-" + key),
        );
    }
    const storage = this.q("[data-storage]");
    if (storage)
      storage.textContent =
        this.preferences.persistence === "device"
          ? "Preferences stay on this device."
          : "Storage is unavailable. Changes apply for this visit.";
    this.update?.();
  }
  say(text) {
    const status = this.q("[data-status]");
    if (status) status.textContent = text;
  }
  fail(text) {
    const error = this.q("[data-error]");
    if (error) error.textContent = text;
  }
}
export function download(text, name, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
