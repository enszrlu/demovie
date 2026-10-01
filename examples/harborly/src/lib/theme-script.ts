export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "harborly-theme";

/** Runs in <head> before first paint (see the root layout); mirrors applyTheme() in theme.ts. */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");var d=p==="dark"||(p!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})();`;
