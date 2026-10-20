// One-time Director script recovery; builds do not depend on this tool or CD.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
const modulePath = process.argv[2] ?? path.join(process.env.TEMP, 'rock-manager-director-tools/node_modules/projectorrays/dist/pkg/node.es.js');
const { DirectorFile } = await import(pathToFileURL(modulePath));
for (const target of ['Mixer.dxr', 'Record01.cxt', 'Record03.cxt']) {
const source = `V:/Movies/${target}`;
const output = `analysis/original/scripts/cd/${target}`;
fs.mkdirSync(output, { recursive: true });
const file = await DirectorFile.readFromPath(source);
try {
  const scripts = file.dumpScripts();
  for (const cast of scripts.casts) for (const script of cast.scripts) {
    const name = `${String(script.scriptId).padStart(5, '0')}-${script.memberName || 'unnamed'}`.replace(/[<>:"/\\|?*]/g, '_');
    fs.writeFileSync(`${output}/${name}.lingo`, script.lingo);
    fs.writeFileSync(`${output}/${name}.bytecode.txt`, script.bytecode);
  }
  fs.writeFileSync(`${output}/metadata.json`, JSON.stringify({ source,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),
    version: scripts.version, scripts: scripts.casts, chunks: file.dumpJSON() }, null, 2));
  console.log(`Recovered ${new Set(scripts.casts.flatMap((c) => c.scripts.map((s) => s.scriptId))).size} scripts from ${target}.`);
} finally { file.destroy(); }
}
