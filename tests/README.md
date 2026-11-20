# 시험(tests)

사이트를 고친 뒤 기존 기능이 그대로인지 확인하는 자동 시험이에요. **사이트 동작과는 무관**하고(사이트는 이 폴더를 쓰지 않음), node가 있는 PC에서만 돌릴 수 있어요.

## 준비 (한 번만)
```
npm i -D playwright
npx playwright install chromium
```

## 실행
```
node tests/run-all.js            # 전체(10~20분)
node tests/run-all.js reads      # 이름이 reads 로 시작하는 시험만
node tests/reads.js              # 하나를 직접 실행(✓/✗ 줄을 그대로 보여 줌)
```

## 어떻게 돌아가나
- `harness.js`: 이 저장소의 파일을 가짜 주소(`https://site.test/?k=test`)로 띄우고, 실제 Firebase 대신 `backend.js`(가짜 Firestore, 읽기·쓰기 횟수도 셈)에 붙인다. 진짜 DB·연동 서버(Worker)·외부 사이트로는 아무것도 보내지 않는다.
- `fake-sdk.js`: 브라우저에서 Firebase SDK 대신 쓰이는 가짜 SDK. `seed.js`: 시험용 선수 24명·경기 300개 등.
- `REPO=다른폴더 node tests/reads.js` 처럼 옛 버전 폴더를 주면 그 버전으로 같은 시험을 돌려 비교할 수 있다(읽기 수 비교 등).
- `worker_*.mjs`: 연동 서버(`worker/worker.js`)를 가짜 라이엇·디스코드·Firestore 응답으로 시험한다.

## 시험 목록
| 파일 | 확인하는 것 |
|---|---|
| `worker_live.mjs` | 연동 서버 `/live`(라이엇 관전 API) 응답 처리 |
| `worker_report.mjs` | 연동 서버 버전·사이트 오류 알림(`/report`) |
| `worker_upd.mjs` | 라이엇 갱신이 선수 문서에 `upd`를 붙이는지, Worker 버전 = 사이트 기대값 |
| `write_fuse.js` | 쓰기 안전장치(1분 100회)·채팅 도배 방지 |
| `error_report.js` | 사이트 오류 자동 보고, 관리 화면 Worker 버전 경고 |
| `chat_posts_limit.js` | 채팅·게시판 실시간 개수, 접힌 이전 글 펼치기 |
| `chat_pc_open.js` | 넓은 PC에서 채팅창을 열어 둔 사람은 처음부터 채팅 20개 |
| `reads.js` | 접속·재접속 읽기 수, 닫힌 채팅창 새 메시지 배지, 선수 증분 구독 |
| `swap_and_edit.js` | 경기 진영 바꾸기(선수 기록 불변), 게시판 글·댓글 수정 |
| `replay_flip.js` | 리플레이 적용 시 반대로 기록된 진영 바로잡기 |
| `me_account.js` | 내 페이지 롤 계정 입력 |
| `multi_device.js` | 여러 기기 동시 접속: 경매 구독, 백업, 서버 시각, 채팅 순서, 접속 표시, 주사위 |

## 알아 둘 점
- 가짜 Firestore 특성상 **가끔 타이밍 때문에 실패**할 수 있다(특히 `multi_device.js`의 경매 화면 첫 데이터). 같은 시험을 한 번 더 돌려 보고, 계속 실패하면 진짜 문제로 본다.
- 시험이 일부러 다시 시도한 경우(예: "백업 다운로드가 안 와서 다시 누름")는 결과에 그대로 찍힌다.
