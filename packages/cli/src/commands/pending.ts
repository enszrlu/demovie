import { DemovieError } from "@demovie/core";
import type { CommandModule } from "./index.ts";

/** Placeholder for commands whose milestone has not landed yet. */
export function pending(name: string, milestone: string): CommandModule {
  return {
    run: async () => {
      throw new DemovieError(
        "E_FAILED",
        `\`demovie ${name}\` is not implemented in this build yet (milestone ${milestone})`,
        "update demovie to a release that includes this command",
      );
    },
  };
}
