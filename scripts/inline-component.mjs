// Splice scripts/_component.js (the editable source of the dc-runtime
// component logic) into the inline <script data-dc-script> block of
// Plotter.dc.html. The dc-runtime evaluates that inline block at runtime, so
// _component.js is the source of truth and this script regenerates the inline
// copy — mirroring how engine.js is generated from src/*.ts.
import fs from "fs";

const FILE = "Plotter.dc.html";
const html = fs.readFileSync(FILE, "utf8");
const comp = fs.readFileSync("scripts/_component.js", "utf8").trimEnd();

const startTag = /<script type="text\/x-dc" data-dc-script>\n/;
const m = html.match(startTag);
if (!m) throw new Error("could not find <script data-dc-script> open tag");
const startIdx = m.index + m[0].length;
const endIdx = html.indexOf("\n</script>", startIdx);
if (endIdx < 0) throw new Error("could not find </script> close tag");

const out = html.slice(0, startIdx) + comp + html.slice(endIdx);
fs.writeFileSync(FILE, out);
console.log(`inlined scripts/_component.js into ${FILE} (${out.length} bytes)`);
