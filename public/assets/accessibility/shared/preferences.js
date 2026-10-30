/* Starlit accessibility preferences. Original implementation informed by Evanswiki and PayCal. */
export const defaults = Object.freeze({
  theme: "system",
  brightness: null,
  size: 1,
  leading: 1.75,
  letter: 0,
  word: 0,
  paragraph: 1.25,
  measure: 68,
  font: "studio",
  align: "start",
  contrast: "standard",
  links: false,
  headings: false,
  focus: false,
  motion: "system",
  hideDecorative: false,
  guide: "off",
  guidePosition: 45,
  cursor: false,
  volume: 1,
  rate: 1,
  captions: false,
});
const enums = {
  theme: ["system", "dark", "light", "warm"],
  font: ["studio", "sans", "serif", "mono"],
  align: ["start", "left"],
  contrast: ["standard", "high"],
  motion: ["system", "reduce"],
  guide: ["off", "line", "mask"],
};
const bounds = {
  brightness: [0, 31],
  size: [1, 2],
  leading: [1.5, 2.5],
  letter: [0, 0.16],
  word: [0, 0.3],
  paragraph: [1, 2.5],
  measure: [40, 85],
  guidePosition: [5, 95],
  volume: [0, 1],
  rate: [0.7, 1.4],
};
export function validate(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("Preferences must be a JSON object.");
  const result = { ...defaults };
  for (const key of Object.keys(defaults)) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
    const value = input[key];
    if (key === "brightness" && value === null) {
      result[key] = null;
      continue;
    }
    if (enums[key]) {
      if (!enums[key].includes(value))
        throw Error("Unsupported value for " + key + ".");
    } else if (bounds[key]) {
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < bounds[key][0] ||
        value > bounds[key][1]
      )
        throw Error("Value outside the supported range for " + key + ".");
    } else if (typeof value !== "boolean")
      throw Error("Expected an on or off value for " + key + ".");
    result[key] = value;
  }
  return result;
}
const rgb = (hex) =>
  hex
    .replace("#", "")
    .match(/../g)
    .map((n) => parseInt(n, 16));
const toHex = (c) =>
  "#" +
  c
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
export function luminance(color) {
  return rgb(color)
    .map((v) => {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    })
    .reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
}
export function contrast(a, b) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function palette(state, darkSystem = true) {
  let theme =
    state.theme === "system" ? (darkSystem ? "dark" : "light") : state.theme;
  let page =
    state.brightness === null
      ? { dark: "#09151f", light: "#f7f3eb", warm: "#eee2cb" }[theme]
      : toHex(mix(rgb("#09151f"), rgb("#f7f3eb"), state.brightness / 31));
  let ink =
    contrast(page, "#ffffff") >= contrast(page, "#000000")
      ? "#ffffff"
      : "#000000";
  if (state.contrast === "high") {
    page = ink === "#ffffff" ? "#000000" : "#ffffff";
  }
  // At the middle shades, move the surface slightly so even the weakest pair clears PayCal's 5:1 floor.
  for (let i = 0; contrast(page, ink) < 5.05 && i < 80; i++)
    page = toHex(
      mix(rgb(page), rgb(ink === "#ffffff" ? "#000000" : "#ffffff"), 0.025),
    );
  const dark = ink === "#ffffff",
    panelCandidate = toHex(mix(rgb(page), rgb(ink), 0.025));
  const panel = contrast(panelCandidate, ink) >= 5.05 ? panelCandidate : page;
  const candidate = {
    text: dark ? "#f2e7d4" : "#183240",
    muted: dark ? "#bacbd1" : "#455d68",
    accent: dark ? "#e8c58e" : "#76511e",
    secondary: dark ? "#79b7b5" : "#315f61",
    line: dark ? "#bacbd1" : "#455d68",
  };
  const safe = (color) =>
    [page, panel].every((bg) => contrast(bg, color) >= 5.05) ? color : ink;
  const out = { page, panel, ink, dark };
  for (const [key, color] of Object.entries(candidate)) out[key] = safe(color);
  out.minimum = Math.min(
    ...Object.values(candidate)
      .map(safe)
      .flatMap((color) => [contrast(page, color), contrast(panel, color)]),
  );
  return out;
}
const controllers = new WeakMap();
export function getPreferences(target, key = "starlit.a11y.v1") {
  if (!target)
    throw Error("Add a target element or a data-sdou-a11y-content region.");
  if (controllers.has(target)) return controllers.get(target);
  const controller = new PreferenceController(target, key);
  controllers.set(target, controller);
  return controller;
}
export class PreferenceController extends EventTarget {
  constructor(target, key) {
    super();
    this.target = target;
    this.key = key;
    const theme = target.getAttribute("data-default-theme");
    this.initial = {
      ...defaults,
      theme: ["dark", "light", "warm", "system"].includes(theme)
        ? theme
        : defaults.theme,
    };
    this.state = { ...this.initial };
    this.persistence = "device";
    this.captionModes = new WeakMap();
    try {
      const saved = localStorage.getItem(key);
      if (saved) this.state = validate(JSON.parse(saved));
    } catch {
      this.persistence = "session";
    }
    this.scheme = matchMedia("(prefers-color-scheme: dark)");
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)");
    this.osChange = () => this.apply();
    this.scheme.addEventListener("change", this.osChange);
    this.reduced.addEventListener("change", this.osChange);
    this.target.dataset.sdouA11y = "";
    this.apply();
    this.storageChange = (e) => {
      if (e.key === key) {
        try {
          this.state = e.newValue
            ? validate(JSON.parse(e.newValue))
            : { ...this.initial };
          this.apply();
        } catch {}
      }
    };
    window.addEventListener("storage", this.storageChange);
  }
  set(patch) {
    this.state = validate({ ...this.state, ...patch });
    try {
      localStorage.setItem(this.key, JSON.stringify(this.state));
      this.persistence = "device";
    } catch {
      this.persistence = "session";
    }
    this.apply();
  }
  reset() {
    this.state = { ...this.initial };
    try {
      localStorage.removeItem(this.key);
    } catch {}
    this.apply();
  }
  apply() {
    const s = this.state,
      t = this.target,
      p = palette(s, this.scheme.matches);
    this.colors = p;
    for (const key of [
      "page",
      "panel",
      "text",
      "muted",
      "accent",
      "secondary",
      "line",
    ])
      t.style.setProperty("--sdou-a11y-" + key, p[key]);
    for (const [key, value] of Object.entries({
      scale: s.size,
      leading: s.leading,
      letter: s.letter + "em",
      word: s.word + "em",
      paragraph: s.paragraph + "em",
      measure: s.measure + "ch",
      align: s.align,
      font: {
        studio: "Georgia,serif",
        sans: "Verdana,Arial,sans-serif",
        serif: "Georgia,serif",
        mono: "ui-monospace,monospace",
      }[s.font],
    }))
      t.style.setProperty("--sdou-a11y-" + key, value);
    for (const key of [
      "links",
      "headings",
      "focus",
      "hideDecorative",
      "cursor",
    ])
      t.dataset["sdouA11y" + key[0].toUpperCase() + key.slice(1)] = String(s[key]);
    t.dataset.sdouA11yMotion =
      s.motion === "reduce" || this.reduced.matches ? "reduce" : "system";
    t.dataset.sdouA11yContrast = s.contrast;
    t.querySelectorAll("video").forEach((v) =>
      [...v.textTracks].forEach((track) => {
        if (!["captions", "subtitles"].includes(track.kind)) return;
        if (s.captions) {
          if (!this.captionModes.has(track))
            this.captionModes.set(track, track.mode);
          track.mode = "showing";
        } else if (this.captionModes.has(track)) {
          track.mode = this.captionModes.get(track);
          this.captionModes.delete(track);
        }
      }),
    );
    if (t.dataset.sdouA11yMotion === "reduce") this.pauseMedia();
    this.updateGuide();
    this.dispatchEvent(
      new CustomEvent("change", { detail: { state: { ...s }, palette: p } }),
    );
    t.dispatchEvent(
      new CustomEvent("sdou:a11y-change", {
        bubbles: true,
        detail: {
          preferences: { ...s },
          reducedMotion: t.dataset.sdouA11yMotion === "reduce",
          palette: p,
        },
      }),
    );
  }
  pauseMedia() {
    this.target.querySelectorAll("video,audio").forEach((v) => {
      v.pause();
    });
    this.target.dispatchEvent(
      new CustomEvent("sdou:pause-media", { bubbles: true }),
    );
  }
  updateGuide() {
    if (this.state.guide === "off") {
      this.guide?.remove();
      this.guide = null;
      if (this.guideAbort) {
        this.guideAbort.abort();
        this.guideAbort = null;
      }
      return;
    }
    if (!this.guide) {
      this.guide = document.createElement("div");
      this.guide.className = "sdou-a11y-reading-guide";
      this.guide.setAttribute("aria-hidden", "true");
      this.guide.innerHTML = "<i></i><b></b><i></i>";
      document.body.append(this.guide);
      this.guideAbort = new AbortController();
      const signal = this.guideAbort.signal;
      this.guidePosition = null;
      const refresh = () => this.positionGuide();
      addEventListener("scroll", refresh, { passive: true, signal });
      addEventListener("resize", refresh, { passive: true, signal });
      this.target.addEventListener(
        "pointermove",
        (event) => {
          if (event.pointerType === "mouse") {
            this.guidePosition = event.clientY;
            this.positionGuide();
          }
        },
        { passive: true, signal },
      );
      document.addEventListener(
        "keydown",
        (event) => {
          if (
            event.key === "Escape" &&
            !event
              .composedPath()
              .some(
                (node) =>
                  node instanceof HTMLElement &&
                  (node.isContentEditable ||
                    node.matches(
                      "textarea,select,input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=button])",
                    )),
              ) &&
            !event
              .composedPath()
              .some((node) => node instanceof HTMLDialogElement && node.open) &&
            !event.defaultPrevented
          )
            this.set({ guide: "off" });
        },
        { signal },
      );
    }
    this.guide.dataset.mode = this.state.guide;
    this.guidePosition = null;
    this.positionGuide();
  }
  positionGuide() {
    if (!this.guide) return;
    const r = this.target.getBoundingClientRect(),
      top = Math.max(0, r.top),
      bottom = Math.min(innerHeight, r.bottom),
      height = Math.max(0, bottom - top),
      line = Math.max(
        28,
        parseFloat(getComputedStyle(this.target).lineHeight) ||
          parseFloat(getComputedStyle(this.target).fontSize) *
            this.state.leading,
      ),
      y = Math.max(
        top,
        Math.min(
          bottom - line,
          this.guidePosition ?? top + (height * this.state.guidePosition) / 100,
        ),
      );
    this.guide.style.left = Math.max(0, r.left) + "px";
    this.guide.style.width =
      Math.min(innerWidth, r.right) - Math.max(0, r.left) + "px";
    this.guide.style.top = top + "px";
    this.guide.style.height = height + "px";
    this.guide.style.setProperty("--guide-y", Math.max(0, y - top) + "px");
    this.guide.style.setProperty("--guide-height", line + "px");
    this.guide.style.setProperty("--guide-color", this.colors.accent);
    this.guide.hidden = height <= 0;
  }
  dispose() {
    this.scheme.removeEventListener("change", this.osChange);
    this.reduced.removeEventListener("change", this.osChange);
    window.removeEventListener("storage", this.storageChange);
    this.guideAbort?.abort();
    this.guide?.remove();
    controllers.delete(this.target);
  }
  export() {
    return JSON.stringify(
      { format: "starlit-a11y", version: 1, preferences: this.state },
      null,
      2,
    );
  }
  import(raw) {
    if (raw.length > 10000)
      throw Error("Choose a preferences file smaller than 10 KB.");
    const data = JSON.parse(raw);
    if (data.format !== "starlit-a11y" || data.version !== 1)
      throw Error("Choose a Starlit accessibility preferences file.");
    this.state = validate(data.preferences);
    this.set({});
  }
}
