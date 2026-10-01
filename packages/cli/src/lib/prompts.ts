import * as clack from "@clack/prompts";
import { DemovieError } from "@demovie/core";

function unwrap<T>(value: unknown): T {
  if (clack.isCancel(value)) {
    clack.cancel("Cancelled.");
    throw new DemovieError(
      "E_USAGE",
      "cancelled by the user",
      "re-run the command, or pass --yes to accept the defaults",
    );
  }
  return value as T;
}

export const ask = {
  text: async (
    message: string,
    options: { initial?: string; placeholder?: string; optional?: boolean } = {},
  ): Promise<string> =>
    unwrap<string>(
      await clack.text({
        message,
        ...(options.initial !== undefined ? { initialValue: options.initial } : {}),
        ...(options.placeholder !== undefined ? { placeholder: options.placeholder } : {}),
        validate: (v) => (options.optional || (v ?? "").trim() ? undefined : "required"),
      }),
    ).trim(),
  password: async (message: string): Promise<string> =>
    unwrap<string>(await clack.password({ message, validate: (v) => ((v ?? "").length ? undefined : "required") })),
  confirm: async (message: string, initial = true): Promise<boolean> =>
    unwrap<boolean>(await clack.confirm({ message, initialValue: initial })),
  select: async <T extends string>(
    message: string,
    options: { value: T; label: string; hint?: string }[],
    initial?: T,
  ) =>
    unwrap<T>(
      await clack.select<T>({
        message,
        options: options as never,
        ...(initial !== undefined ? { initialValue: initial } : {}),
      }),
    ) as T,
  multiselect: async <T extends string>(
    message: string,
    options: { value: T; label: string; hint?: string }[],
    initial: T[] = [],
  ) =>
    unwrap<T[]>(
      await clack.multiselect<T>({ message, options: options as never, initialValues: initial, required: false }),
    ) as T[],
};

export { clack };
