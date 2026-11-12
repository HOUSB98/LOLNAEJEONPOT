# 작업 지침 (Claude Code용)

- 답변은 한국어. 사용량 절약: 확실한 건 묻지 말고 진행, 갈림길에서만 짧게 질문.
- 구조·데이터 모델·설정 절차는 `README.md` 참고.
- 빌드 도구 없음(순수 ES 모듈). node/git이 없는 PC에서도 수정 가능해야 한다. 미리보기는 `serve.ps1`.
- 통계는 저장하지 않고 `js/stats.js`의 `compute()`가 매번 경기 기록에서 다시 계산한다.
- DB 문서는 지우지 않는다(`deleted:true`). Firestore는 중첩 배열·undefined를 받지 않는다.
- 사용자 계정으로 해야 하는 일(GitHub, Firebase)은 "여기를 눌러 주세요" 식으로 짧게 안내.
- 남은 일: 스크린샷/.rofl 자동 입력 검토(샘플 파일로 파싱 가능 여부부터), Firebase 연결 후 실기기 테스트.
