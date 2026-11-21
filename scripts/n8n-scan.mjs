// Runs the n8n Creator Portal community-node scan against the LOCAL source, so
// lint violations are caught in CI before publishing instead of after the
// portal rejects the release. It reuses the portal scanner's own analyzePackage
// (same ESLint ruleset) so this gate tracks whatever the portal enforces.
//
// The scanner MUST be installed in isolation — its pinned toolchain (TypeScript
// 7, ESLint 9) conflicts with this project's own devDeps if merged into the same
// node_modules. CI installs it in a throwaway dir and points here via env:
//
//   tmp=$(mktemp -d)
//   ( cd "$tmp" && npm init -y >/dev/null && npm i --ignore-scripts @n8n/scan-community-package@beta )
//   N8N_SCANNER_PATH="$tmp/node_modules/@n8n/scan-community-package/scanner/scanner.mjs" \
//     node scripts/n8n-scan.mjs
//
// (--ignore-scripts skips a native module the scanner pulls in but never uses for linting.)
//
// Newer scanner releases (0.44.0 and 1.3.0 checked) keep the entry at dist/scanner.js and export
// lintDirectory in place of analyzePackage. This script takes either, so only the path changes.
//
// The published scanner also lints the built tarball's *.js, but CI already
// verifies dist/ matches source (git diff), so linting the source leg here is
// sufficient.
const scannerPath =
  process.env.N8N_SCANNER_PATH ?? '@n8n/scan-community-package/scanner/scanner.mjs';
const scanner = await import(scannerPath);
const { SOURCE_FILE_PATTERNS } = scanner;
const analyze = scanner.analyzePackage ?? scanner.lintDirectory;

const target = process.argv[2] ?? process.cwd();
const result = await analyze(target, SOURCE_FILE_PATTERNS);

if (!result.passed) {
  console.error('n8n community-node scan failed\n');
  console.error(result.details ?? result.message ?? 'unknown error');
  process.exit(1);
}

console.log('n8n community-node scan passed');
