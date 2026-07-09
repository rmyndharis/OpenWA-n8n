const { src, dest } = require('gulp');

function buildIcons() {
  // base: '.' preserves the credentials/ and nodes/ prefix in the output so each
  // icon lands next to its compiled node/credential (e.g. dist/nodes/OpenWa/openwa.svg).
  return src(['credentials/**/*.{png,svg}', 'nodes/**/*.{png,svg}'], { base: '.' }).pipe(dest('dist'));
}

exports['build:icons'] = buildIcons;
