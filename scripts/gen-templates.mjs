// Regenerate the /public sample templates from the built engine so they always
// match the parser's expected LONG / WIDE layouts. Run after build.mjs.
import { createRequire } from "module";
import fs from "fs";

const require = createRequire(import.meta.url);
require("../engine.js");
const { parse } = globalThis.PlotterEngine;

fs.mkdirSync("public", { recursive: true });
fs.writeFileSync("public/plotter-template-long.csv", parse.toCsv(parse.templateRows("long")) + "\n");
fs.writeFileSync("public/plotter-template-wide.csv", parse.toCsv(parse.templateRows("wide")) + "\n");
console.log("wrote public/plotter-template-{long,wide}.csv");
