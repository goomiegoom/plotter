// Bundle the TypeScript engine (src/index.ts) into the committed, browser-ready
// engine.js that Plotter.dc.html loads via <helmet>. SheetJS / React are
// treated as runtime globals (loaded from a CDN), not bundled.
import { build, context } from "esbuild";

const options = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  format: "iife",
  globalName: "PlotterEngineBundle",
  target: ["es2019"],
  outfile: "engine.js",
  banner: {
    js: "/* GENERATED from src/*.ts by scripts/build.mjs — do not edit. Rebuild with `npm run build`. */",
  },
  legalComments: "none",
  logLevel: "info",
};

if (process.argv.includes("--watch")) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("watching src/ …");
} else {
  await build(options);
  console.log("built engine.js");
}
