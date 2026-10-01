/* Layout for this video. Colors, type and motion tokens come from the brand and the {{STYLE}} preset
   (/__demovie/styles/{{STYLE}}.css, injected by the runtime). */

.center {
  position: absolute;
  inset: var(--dm-safe-top) var(--dm-safe-right) var(--dm-safe-bottom) var(--dm-safe-left);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: calc(var(--dm-unit) * 4);
  text-align: center;
}

.center .dm-title {
  max-width: 18ch;
}

[data-format="9:16"] .center .dm-title {
  max-width: 10ch;
}

.end-logo .dm-logo__img {
  height: calc(var(--dm-unit) * 12);
}

.end .url {
  margin: 0;
  font: 500 calc(var(--dm-unit) * 3.4) / 1.2 var(--dm-font-body);
  color: var(--dm-muted-fg);
}
