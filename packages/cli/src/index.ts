#!/usr/bin/env node
import { buildProgram } from "./program.ts";

const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);
if (major < 20 || (major === 20 && minor < 19)) {
  process.stderr.write(
    `error: demovie needs Node.js >= 20.19 (found ${process.versions.node})\nfix: install Node.js 22 LTS from https://nodejs.org and re-run\n`,
  );
  process.exit(3);
}

await buildProgram().parseAsync(process.argv);
