import {
  A11yComponent,
  group,
  typography,
  appearance,
  motion,
  focus,
  preview,
} from "../../shared/base.js?v=sdou20261029b";
class PreferencesCenter extends A11yComponent {
  static styles = new URL(
    "./component.css?v=sdou20261029b",
    import.meta.url,
  ).href;
  render() {
    this.resetAll = true;
    this.mount(
      "Your reading space",
      "Make the page feel comfortable. Every setting is optional and stays on your device.",
      group("Appearance", appearance(), true) +
        group("Text and spacing", typography()) +
        group("Motion and media", motion()) +
        group("Focus and navigation", focus()) +
        preview +
        '<p class="hint">Reading text contrast: <strong class="number" data-contrast-ratio></strong>. Our minimum is 5:1.</p>',
      { dialog: true },
    );
    this.q("[data-reset]").textContent = "Reset all preferences";
    // Canonical presentation, promoted from the existing sltd.ca full center.
    this.q(".kicker")?.remove();
    this.q("[data-pref=theme]")?.closest(".control").remove();
    this.q("[data-pref=font] option[value=studio]").textContent =
      "Studio default";
    const button = this.q("[data-open]");
    button.setAttribute("aria-label", "Accessibility preferences");
    button.title = "Accessibility preferences";
    const motionGroup = this.qa("details").find(
      (el) => el.querySelector("summary").textContent === "Motion and media",
    );
    const pause = document.createElement("button");
    pause.type = "button";
    pause.className = "button secondary";
    pause.textContent = "Pause page media";
    pause.dataset.pausePageMedia = "";
    this.on(pause, "click", () => {
      this.preferences.pauseMedia();
      this.say(
        "Page audio and video paused. Playback stays under your control.",
      );
    });
    motionGroup.querySelector(".group-body").append(pause);
  }
  sync() {
    super.sync();
    if (!this.preferences) return;
    const p = this.preferences.colors;
    for (const [name, value] of Object.entries({
      bg: p.page,
      panel: p.panel,
      raised: p.panel,
      hover: p.panel,
      ink: p.text,
      muted: p.muted,
      gold: p.accent,
      teal: p.secondary,
      line: p.line,
      error: p.text,
    }))
      this.style.setProperty("--sdou-ax-" + name, value);
    for (const [name, value] of Object.entries({
      gold: p.accent,
      panel: p.panel,
      ink: p.text,
    }))
      this.style.setProperty("--studio-" + name, value);
    this.style.colorScheme = p.dark ? "dark" : "light";
    const slider = this.q("[data-pref=brightness]"),
      output = this.q("[data-output=brightness]");
    if (slider && output) {
      output.value =
        "Shade " + (Math.round(Number(slider.value)) + 1) + " of 32";
      slider.setAttribute("aria-valuetext", output.value);
    }
  }
  update() {
    const output = this.q("[data-contrast-ratio]");
    if (output)
      output.textContent = this.preferences.colors.minimum.toFixed(2) + ":1";
  }
}
customElements.define("sdou-preferences-center", PreferencesCenter);
