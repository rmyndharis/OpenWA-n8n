const { src, dest } = require('gulp');

function buildIcons() {
  return src('src/**/*.{png,svg}').pipe(dest('dist'));
}

exports['build:icons'] = buildIcons;
