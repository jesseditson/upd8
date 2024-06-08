#!/usr/bin/env node

import esbuild from "esbuild";

const dev = process.argv.includes("--dev");

await esbuild.build({
  entryPoints: ["src/upd8.ts"],
  bundle: false,
  outfile: "lib/upd8.js",
  platform: "node",
  target: ["node20"],
  packages: "external",
  sourcemap: dev,
});
