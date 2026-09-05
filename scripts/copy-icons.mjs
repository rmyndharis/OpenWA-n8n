// Copies the node and credential icons into dist/, next to the compiled files that
// reference them (`icon: 'file:openwa.svg'` resolves relative to the .js).
//
// This replaced a gulpfile whose only job was these three copies. gulp brought 309
// packages, 53% of the toolchain, to do what fs.cpSync does in one call.
//
// The source prefix is preserved (credentials/openwa.svg -> dist/credentials/openwa.svg),
// which is what `{ base: '.' }` did before.
import { cpSync, existsSync, statSync } from 'node:fs';

const ICON = /\.(svg|png)$/i;

for (const dir of ['credentials', 'nodes']) {
  if (!existsSync(dir)) {
    continue;
  }
  cpSync(dir, `dist/${dir}`, {
    recursive: true,
    // A directory has to pass the filter or cpSync never walks into it, so the
    // extension test applies to files only.
    filter: (src) => statSync(src).isDirectory() || ICON.test(src),
  });
}
