# Script Writer (웹 프로토타입)

시나리오 에디터 웹 버전. **단일 폴더로 독립 동작**하며, 다른 레포에 복사해 그대로 배포할 수 있습니다.

- `npm install` → `npm run build` → `dist` 배포 (Vercel 등)
- 대시보드·배율·파일/EXE 기능 없음, 에디터 핵심만 포함

## 로컬 실행

```bash
npm install
npm run dev
```

## 배포 (Vercel)

이 폴더만 새 GitHub 저장소에 넣고, Vercel에서 해당 저장소 연결 후 배포하면 됩니다. `vercel.json`이 이미 포함되어 있습니다.
