# Script Writer Web (SWW) — 배포용

이 폴더는 **Cloudflare Pages** 배포 전용입니다.  
빌드 산출물만 포함되어 있으며, 소스/개발 의존성은 포함하지 않습니다.

## 배포

- **대상**: Cloudflare Pages (Assets)
- **출력 디렉터리**: `.` (이 폴더 루트)
- GitHub 저장소에 이 폴더 내용만 푸시한 뒤 Cloudflare에서 해당 저장소를 연결하면 됩니다.
- `wrangler.toml`에서 `[assets] directory = "."` 로 설정되어 있습니다.

## 포함 내용

- `index.html` — 진입점
- `assets/` — JS, CSS 번들
- `_redirects` — SPA 라우팅(모든 경로 → index.html 200)
- `wrangler.toml` — Cloudflare 설정
