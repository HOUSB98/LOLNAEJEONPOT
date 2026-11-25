// Firebase 웹 앱 설정. 공개되어도 되는 값입니다(비밀키 아님). 실제 열쇠는 초대 링크의 ?k= 코드입니다.
// null 로 바꾸면 "체험 모드"(이 브라우저에만 저장)로 동작합니다.
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBx9DdwpagQTZqFqkISJLPpRe7zHYKOgC0",
  authDomain: "lolnaejeonpot.firebaseapp.com",
  projectId: "lolnaejeonpot",
  storageBucket: "lolnaejeonpot.firebasestorage.app",
  messagingSenderId: "119632359909",
  appId: "1:119632359909:web:ac3f8c1c5e87c4dea13f0c",
};

// 연동 서버(Cloudflare Worker) 주소. 디스코드 알림·Firebase 사용량·라이엇 전적 자동 갱신에 쓴다.
// 비워 두면 해당 기능만 꺼지고 사이트는 그대로 동작한다. 설정 방법은 worker/README.md 참고.
export const WORKER_URL = 'https://naejeonpot.idairo0401.workers.dev';

// 카카오톡 공유(js/kakao.js)용 카카오 JavaScript 키. 사이트 코드에 공개되는 종류의 키다(비밀 아님).
// 카카오 개발자 콘솔에 등록한 사이트 주소(https://housb98.github.io)에서만 동작한다. 비워 두면 카톡 공유 버튼이 숨는다.
export const KAKAO_JS_KEY = '6316315a1de926afd006fa59bc5bcf1c';
