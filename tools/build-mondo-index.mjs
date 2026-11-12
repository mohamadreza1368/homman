import { readFile, writeFile, mkdir } from "node:fs/promises";

// Build a small, offline search index from an official Mondo OBO release.
const input = process.argv[2];
if (!input) throw new Error("Usage: node tools/build-mondo-index.mjs <mondo-base.obo>");
const obo = await readFile(input, "utf8");
const release = obo.match(/^data-version: (.+)$/m)?.[1];
if (!release || !obo.includes("[Term]")) throw new Error("Invalid or incomplete Mondo file");
const entries = [];
for (const block of obo.split(/^\[Term\]\s*$/m).slice(1)) {
  const term = block.split(/^\[(?:Term|Typedef)\]\s*$/m)[0];
  const id = term.match(/^id: (MONDO:\d+)$/m)?.[1];
  const name = term.match(/^name: (.+)$/m)?.[1];
  if (!id || !name || /^is_obsolete: true$/m.test(term) || /^subset: not_a_disease$/m.test(term)) continue;
  const synonyms = [...term.matchAll(/^synonym: "((?:\\.|[^"\\])*)" EXACT(?:\s|$)/gm)]
    .map((match) => match[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
  entries.push([id, name, ...new Set(synonyms.filter((s) => s.toLowerCase() !== name.toLowerCase()))]);
}
if (entries.length < 10000) throw new Error(`Incomplete source: only ${entries.length} terms`);
await mkdir("public/diseases", { recursive: true });
await writeFile("public/diseases/mondo-index.json", JSON.stringify({ release, entries }));
console.log(`Indexed ${entries.length} terms from ${release}`);
