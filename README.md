# Script Writer Web (SWW) — 배포용

이 폴더는 **Cloudflare Pages** 배포 전용입니다.  
**이미 빌드된 정적 파일**만 포함되어 있으며, `package.json`·소스·개발 의존성은 없습니다.

## Cloudflare Pages 설정 (필수)

저장소 연결 후 **빌드 단계를 실행하면 안 됩니다.** (npm run build 불필요)

- **Framework preset**: None (또는 None으로 설정)
- **Build command**: **비워 두기** (빈 칸) — 또는 `echo "No build"` 등 아무 명령
- **Build output directory**: ` . ` (루트, 즉 이 저장소 루트)
- **Root directory**: 비워 두기 (저장소 루트 사용)

이렇게 하면 Cloudflare가 `npm run build`를 실행하지 않고, 푸시된 `index.html`과 `assets/`를 그대로 서빙합니다.

## 포함 내용

- `index.html` — 진입점
- `assets/` — JS, CSS 번들
- `_redirects` — SPA 라우팅(모든 경로 → index.html 200)
- `wrangler.toml` — Cloudflare 설정
