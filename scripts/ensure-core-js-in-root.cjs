/**
 * Vercel: commonjs 플러그인이 /vercel/path0/node_modules/core-js 를 참조하는데
 * 실제 설치는 script-writer-web/node_modules 에만 있음.
 * 빌드 전에 현재 node_modules/core-js 를 상위(루트) node_modules 로 복사함.
 */
const path = require('path');
const fs = require('fs');

const cwd = process.cwd();
const src = path.join(cwd, 'node_modules', 'core-js');
const destDir = path.join(cwd, '..', 'node_modules');
const dest = path.join(destDir, 'core-js');

if (!fs.existsSync(src)) {
  console.warn('[ensure-core-js] core-js not found in', src);
  process.exit(0);
}

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

fs.cpSync(src, dest, { recursive: true, force: true });
console.log('[ensure-core-js] copied core-js to', dest);
