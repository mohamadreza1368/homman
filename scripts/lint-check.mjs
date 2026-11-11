import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'frontend', 'src');

const FORBIDDEN_OVERCLAIMS = [
  'شبیه‌ساز بیماری',
  'شبیه‌سازی پارامتریک اثر پاتولوژی روی بافت',
  'شدت بالینی بیماری',
  'تشخیص قطعی',
  'mockPathology',
  'MOCK_PATHOLOGY_DISORDERS',
];

const violations = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'tests' || entry.name === 'node_modules') continue;
      walk(full);
    } else if (/\.(ts|tsx|html)$/.test(entry.name)) {
      const content = fs.readFileSync(full, 'utf-8');
      for (const phrase of FORBIDDEN_OVERCLAIMS) {
        if (content.includes(phrase)) {
          violations.push(`${path.relative(rootDir, full)}: contains restricted/legacy phrase "${phrase}"`);
        }
      }
    }
  }
}

walk(srcDir);
walk(path.join(rootDir, 'frontend'));

// Also check README does not use local file:/// paths
const readme = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf-8');
if (readme.includes('file:///')) {
  violations.push('README.md still contains local file:/// links instead of relative GitHub links.');
}

if (violations.length > 0) {
  console.error('[LINT / POLICY CHECK FAILED]');
  for (const v of violations) console.error(' -', v);
  process.exit(1);
}

console.log('[LINT / EDUCATIONAL POLICY CHECK PASSED] Zero overclaims, mock leaks, or local file links detected.');
