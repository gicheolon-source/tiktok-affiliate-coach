# Dr.Reju-All · 틱톡 어필리에이트 영상 코치

TikTok Shop 어필리에이트 영상 연습용 웹앱. **카메라로 영상을 녹화**하면 프레임(비주얼)과
음성 전사를 함께 Claude 멀티모달로 분석해서 어필리에이트 영상으로 **점수**를 매깁니다.

## 채점 항목
- **Key idea** — 하나의 명확한 메시지인가
- **Video hook** — 첫 3초(첫 프레임 + 오프닝 멘트)가 스크롤을 멈추는가
- **Selling point** — 전사가 제품의 실제 셀링포인트를 정확히 전달했는가 (제품 사실 기준)
- **Camera action** — 프레임에서 구도(9:16)·조명·제품 노출·시연·에너지
- **Delivery** — 페이스·명료성·자연스러운 영어
- **Ad-safety** — 틱톡 금지어/과장 클레임(miracle·heals·anti-aging·"Amazon" 등) 자동 플래그

결과: 종합 점수(1-100) + 등급 + 셀링포인트 hit/miss + 카메라 코칭 + 더 강한 훅/개선 대본.

## 동작 방식
- 브라우저에서 `getUserMedia`로 카메라+마이크 → `MediaRecorder` 녹화, 녹화 중 프레임 캡처.
- Web Speech API로 실시간 전사(미지원 시 직접 입력).
- 프레임 최대 8장(저해상도) + 전사를 Claude(비전)로 전송 → 구조화 채점.
- **영상 원본은 서버로 전송/저장되지 않음** (채점용 저해상도 프레임만 전송).

## API 키 — 두 가지 방식
1. **개인·로컬용:** 설정에서 본인 Claude API 키 입력(이 브라우저 localStorage에만 저장).
2. **서버 키(팀 공용):** Vercel 서버리스 `api/feedback.js`가 서버 키로 대신 호출.
   - `ANTHROPIC_API_KEY` = `sk-ant-...` (필수)
   - `APP_PASSCODE` = 짧은 접속 비밀번호 (권장) → 사용자는 이 비밀번호만 입력.

## 배포 (Vercel, 빌드 불필요 · 정적 + 서버리스 함수)
1. 이 폴더를 GitHub 새 저장소에 push.
2. Vercel에서 New Project → 그 저장소 Import → 그대로 Deploy (Framework: Other).
3. Settings → Environment Variables 에 `ANTHROPIC_API_KEY`(+선택 `APP_PASSCODE`) 추가 후 Redeploy.
4. 이후 `git push` 하면 자동 배포.

## 요구사항
- Chrome 권장(음성인식/녹화), 카메라·마이크 권한, HTTPS(배포 시 자동).
