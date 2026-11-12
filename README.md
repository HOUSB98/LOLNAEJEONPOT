# 내전 기록실 (롤 5v5 내전 웹앱)

구글 시트 "내전 팀짜기"를 대체하는 웹앱. 설치·빌드가 필요 없는 정적 웹앱(HTML+JS)이고, 데이터는 Firebase Firestore에 저장된다.

## 기능
- **리더보드**: 승률·최근 5판·연속·OVR·내전 MMR·컨디션·칭호, 라인 점수, 라인별 승률, 명예의 전당
- **오늘의 내전**: 라인업 보드(점수 격차·예상승률·MMR·해설위원 한마디·시너지 듀오) → 승패/챔피언/밴/KDA 입력
- **경기 기록**: 날짜별 기록, 수정·삭제(복구 가능), CSV 내보내기
- **선수**: 플레이어 카드(라인 파워, 케미, 맞라인 전적, 챔피언, 솔랭 분석)
- **케미**: 베스트/상극 듀오, 천적/밥, 듀오·상대 매트릭스
- **챔피언**: 픽·승률·밴·주 사용자
- **피어리스**: 시리즈별 사용 챔피언과 남은 챔피언 풀 (입력 화면에서도 자동으로 잠김)
- **경매**: 팀장 포인트 입찰, 동기화 타이머, 유찰·재경매, 핸디캡, 채팅, 결과를 라인업으로 보내기
- **관리**: 선수/점수 수정, 시트 데이터 가져오기, 설정, 백업·복원, 칭호 도감

## 처음 설정 (한 번만)
1. **Firebase**: https://console.firebase.google.com → 프로젝트 추가 → 빌드 > Firestore Database > 데이터베이스 만들기(프로덕션 모드, 위치 asia-northeast3)
2. Firestore **규칙** 탭에 `firestore.rules` 내용을 붙여넣고 게시
3. 프로젝트 설정(톱니바퀴) > 내 앱 > 웹 앱(`</>`) 추가 → 나오는 `firebaseConfig`를 `js/config.js`의 `FIREBASE_CONFIG`에 붙여넣기
4. **GitHub**: 새 저장소(Public) 생성 → 이 폴더의 파일을 전부 업로드 → Settings > Pages > Branch `main` / `/ (root)` 저장
5. `https://아이디.github.io/저장소이름/` 접속 → "새 리그 만들기" → 만들어진 주소(`?k=...` 포함)가 초대 링크
6. 관리 > "시트 데이터 가져오기" (이때 정하는 PIN이 관리자 PIN)

## 보안 방식
- 가입·로그인 없음. **초대 링크의 `?k=` 코드가 열쇠**다. 링크를 아는 사람만 읽고 쓸 수 있다.
- DB에서 완전 삭제는 규칙으로 막혀 있다. 앱의 삭제는 "삭제 표시"라서 관리에서 복구할 수 있다.
- 점수 수정·경기 삭제·설정은 관리자 PIN이 필요하다. PIN은 화면 잠금 수준(실수·장난 방지)이며, 링크를 가진 사람이 작정하면 우회할 수 있다. 그래서 가끔 "전체 백업"을 받아 둔다.

## 다른 PC에서 이어서 작업하기
GitHub 저장소가 원본이다. 집 PC에서 저장소를 내려받아(Download ZIP 또는 git clone) 수정하고 다시 올리면 된다.
로컬 미리보기: `serve.ps1` 우클릭 > PowerShell에서 실행 → http://localhost:5173 (config가 비어 있으면 체험 모드).

## 구조
- `index.html`, `css/style.css`
- `js/config.js` Firebase 설정 · `js/store.js` 데이터 계층(Firestore/체험 모드) · `js/stats.js` 모든 통계·MMR·칭호 계산
- `js/core.js` 공통(라우터·모달·챔피언 선택) · `js/app.js` 리더보드·기록·챔피언·피어리스 · `js/today.js` 입력 · `js/players.js` 선수·케미 · `js/auction.js` 경매 · `js/admin.js` 관리
- `data/seed.js` 시트 스냅샷(2026-11-12)

## 데이터 모델 (Firestore: `leagues/{코드}/...`)
- `players/{id}`: name, scores{top,jg,mid,adc,sup}, mainLane, soloTier, riotId, mmrInit, solo{record,peak,most,pos,comment}, deleted
- `matches/{id}`: at, seriesId, blue[5], red[5] (탑→서폿 순서의 선수 id), winner, champs{blue[5],red[5]}, bans, kda{선수id:[k,d,a]}, snap{bs,rs,pBlue}(기록 당시 점수·예상승률), deleted
- `auctions/{id}`: 경매 방 상태 · `meta/settings`: leagueName, scale, k, pinHash · `history/*`: 수정·삭제 전 원본

## 계산 기준
- 예상승률 = 1/(1+10^(−점수차/스케일)), 스케일 기본 23.5
- MMR: 시작값 = 솔랭 티어 환산(없으면 900+40×평균점수), 경기마다 Elo(K=12, 팀 평균)
- OVR = MMR 환산 50% + 상위 3개 라인 점수 50% (시트의 수식과 조금 다를 수 있음)
- 새벽 6시 이전 경기는 전날 내전으로 묶음

## 아직 안 한 것
- 스크린샷/.rofl 자동 입력, Riot API 연동
- 과거 시트의 지각금 관리
