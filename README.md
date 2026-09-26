# Dr.Reju-All · 틱톡 어필리에이트 영상 코치

TikTok Shop 어필리에이트 영상 채점 웹앱. 크리에이터가 **게시한 최종 영상을 업로드**(또는 카메라로 바로 녹화)하고
TikTok 링크를 붙이면, 프레임 + 음성 전사 + **EUKA 실제 성과 데이터**를 Claude 멀티모달로 분석해 점수를 매깁니다.

## 채점 항목
- **Key idea / Video hook(첫 3초) / TikTok algorithm fit / Face on camera**
- **Selling point / Product explanation** — 제품 사실 기준으로 셀링포인트 전달 여부
- **Camera action / Delivery**
- **Ad-safety** — 틱톡 금지어·과장 클레임(miracle·heals·anti-aging·"Amazon" 등) 자동 플래그
- (링크 입력 시) EUKA 실제 조회수·좋아요·댓글·GMV·판매수량 반영 — US / UK 스토어

결과: 종합 점수(1-100) + 등급 + 셀링포인트 hit/miss + 카메라 코칭 + 강점·우선 개선점 + 더 강한 훅/개선 대본.

## 구조 (빌드 불필요 · 정적 페이지 + Vercel 서버리스 함수)
| 파일 | 역할 |
|---|---|
| `index.html` | 앱 전체 (UI · 프레임 추출 · 채점 요청) |
| `api/feedback.js` | Claude API 프록시 (서버 키) |
| `api/transcribe.js` | OpenAI Whisper 전사 프록시 (iPhone/Safari 지원) |
| `api/euka.js` | EUKA 영상 성과 조회 (US/UK) |

영상 원본은 서버에 저장되지 않습니다 (저해상도 프레임 + 오디오만 전송).

## 환경 변수 (Vercel → Settings → Environment Variables)
| 이름 | 필수 | 설명 |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | `sk-ant-...` — 채점 |
| `APP_PASSCODE` | ✅ 권장 | 팀 접속 비밀번호. 없으면 URL만 알면 누구나 API 크레딧·스토어 GMV 조회 가능 |
| `OPENAI_API_KEY` | 권장 | Whisper 전사. 없으면 수동 전사 입력 |
| `EUKA_TOKEN` | 선택 | US 스토어 EUKA 토큰 (`Bearer ...` 포함) |
| `EUKA_TOKEN_UK` | 선택 | UK 스토어 EUKA 토큰 (`Bearer ...` 포함) |

## 배포 (Vercel)
1. [vercel.com](https://vercel.com) 로그인 (GitHub 계정으로) → **Add New… → Project**.
2. `tiktok-affiliate-coach` 저장소 **Import** → Framework Preset: **Other** → 빌드 설정은 비워둔 채 **Deploy**.
3. **Settings → Environment Variables**에 위 변수 입력 → **Deployments → Redeploy**.
4. 발급된 `https://<프로젝트>.vercel.app` 접속 → ⚙️ Settings에 `APP_PASSCODE` 입력 후 사용.
5. 이후 `main`에 push하면 자동 재배포.

## 로컬 실행
`python -m http.server 4180` → 정적 UI만 동작 (API 함수는 `vercel dev` 필요, 또는 Settings에 개인 Claude 키 입력).

## 요구사항
- Chrome 권장 (iPhone Safari는 Whisper 서버 키 필요), HTTPS (Vercel 자동).
