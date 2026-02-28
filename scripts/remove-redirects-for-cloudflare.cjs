/**
 * Cloudflare Workers는 _redirects에서 /index.html 로 가는 규칙을 무한 루프(10021)로 간주합니다.
 * wrangler.json 의 not_found_handling: "single-page-application" 으로 SPA 폴백이 되므로
 * 배포 전 dist/_redirects 를 제거합니다. (Netlify 드롭 시에는 public/_redirects 를 수동 포함 가능)
 */
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'dist', '_redirects');
try {
  fs.unlinkSync(p);
  console.log('[remove-redirects] removed dist/_redirects for Cloudflare deploy');
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
