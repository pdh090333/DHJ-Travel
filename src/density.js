// 캘린더 행 밀도 설정. theme.js 와 같은 방식으로 localStorage 에 보관한다.
//
// 왜 기기별(localStorage)인가: 밀도는 본질적으로 화면 크기에 딸린 선택이다.
// 27" 데스크탑에서 고른 "한눈에 보기" 가 15" 노트북까지 따라오면 곤란하므로
// 계정 단위 동기화(Firestore)는 오히려 해롭다.

const STORAGE_KEY = 'calendarDensity';

// 시간당 px. 이 값은 행 높이가 아니라 **바닥**이다 — expandRows 가 화면이
// 크면 이보다 키운다. CalendarView.css 의 --slot-floor 로 들어간다.
//
//   comfortable 88 : 15분 박스 22px - chrome 5px = 17px >= 라인박스 15.6px
//                    → 15분 일정 제목까지 보인다. 대신 대부분 화면에서 스크롤.
//   fit         42 : 30분 기준으로 같은 계산(21 - 5 = 16px).
//                    → 하루 전체가 한 화면에. 15분은 색 막대가 된다.
export const DENSITY_SLOT_PX = { comfortable: 88, fit: 42 };

export const DEFAULT_DENSITY = 'comfortable';

export function getDensityPreference() {
    const saved = localStorage.getItem(STORAGE_KEY);
    // 저장된 값을 믿지 않고 화이트리스트로 검증한다 (theme.js 와 동일)
    return saved === 'fit' || saved === 'comfortable' ? saved : DEFAULT_DENSITY;
}

export function setDensityPreference(density) {
    // 기본값은 키의 부재로 표현한다 (theme.js 의 'auto' 와 같은 규약)
    if (density === DEFAULT_DENSITY) {
        localStorage.removeItem(STORAGE_KEY);
    } else {
        localStorage.setItem(STORAGE_KEY, density);
    }
}
