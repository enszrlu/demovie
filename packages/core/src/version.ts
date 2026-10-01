declare const __DEMOVIE_VERSION__: string | undefined;

/** The demovie version. Injected at build time; tests define it from packages/cli/package.json. */
export const VERSION: string = typeof __DEMOVIE_VERSION__ === "string" ? __DEMOVIE_VERSION__ : "0.0.0-dev";
