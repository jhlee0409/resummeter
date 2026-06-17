# Vercel 배포 가이드

Resummeter는 **Gemini API 키를 서버사이드(Serverless Function)에만 두고** 클라이언트는
`/api/gemini` 프록시를 경유한다. 키는 빌드 산출물(클라이언트 번들)에 절대 포함되지 않는다.

## 구조

```
브라우저 (getAI() shim)  ──POST /api/gemini──▶  api/gemini.ts (Vercel Function, 키 보관)  ──▶  Gemini API
```

- `api/gemini.ts` — Vercel Serverless Function (엔드포인트)
- `api/_gemini.ts` — 공유 핸들러 (`_` 접두사라 라우트로 노출되지 않음). Vite dev 미들웨어도 사용
- `shared/api/geminiClient.ts` `getAI()` — `@google/genai`와 동일 인터페이스의 프록시 shim
- `vite.config.ts` — `define` 키 주입 제거됨. dev는 `configureServer` 미들웨어가 동일 핸들러 사용

## 배포 절차

1. **GitHub 저장소를 Vercel에 임포트** (Add New → Project → 이 repo 선택).
2. Framework Preset은 **Vite**로 자동 감지된다 (`vercel.json`에 명시됨: build `vite build`, output `dist`).
3. **환경변수 등록**: Project → Settings → Environment Variables
   - `GEMINI_API_KEY` = (발급받은 키, https://aistudio.google.com/apikey)
   - Production / Preview / Development 환경 모두 체크 권장.
4. **Deploy**. 끝나면 `https://<project>.vercel.app` 에서 동작.

## 로컬 개발

```bash
cp .env.example .env.local   # GEMINI_API_KEY 채우기
pnpm install
pnpm dev                     # localhost:3000 — /api/gemini 는 dev 미들웨어가 처리
```

> `pnpm preview`는 정적 dist만 서빙하므로 `/api/gemini`가 없다. 풀스택 로컬 확인은
> `pnpm dev` 또는 `vercel dev`를 사용할 것.

## 제약 / 참고

- **요청 본문 한도**: Vercel 함수 본문은 약 4.5MB. 멀티모달 증빙 파일 업로드 상한을
  3MB로 제한했다(`fileService.ts` `MAX_EVIDENCE_FILE_SIZE`). 더 큰 파일이 필요하면
  Vercel Pro + 본문 한도 상향, 또는 Blob 업로드 방식으로 전환해야 한다.
- **함수 실행 시간**: Gemini Pro 호출이 30~60초까지 걸린다. `vercel.json`에서 `api/gemini.ts`의
  `maxDuration`을 60s(Hobby 최대)로 설정해 두었다. 그래도 초과하면 Vercel Pro 플랜(최대 300s)이 필요하다.
  클라이언트(`retry.ts`)도 60s 타임아웃이라 정렬돼 있다.
- **비용**: 모든 사용자의 Gemini 호출 비용을 배포자가 부담한다. 공개 시 쿼터/요금 모니터링 권장.
