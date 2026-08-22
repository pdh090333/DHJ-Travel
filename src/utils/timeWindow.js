// 캘린더에 그릴 시간 범위를 여행의 활동들로부터 계산한다.
//
// 왜 필요한가: 06:00~24:00 을 늘 그리면 18행이라 화면에 안 들어간다.
// 실제 일정이 없는 앞뒤 시간대를 잘라내면 행이 커져 한 화면에 담긴다.
// (Outlook 의 "비근무 시간 숨기기" 를 자동화한 것)
//
// 중간의 빈 시간은 자르지 않는다 — 계획 중에 거기다 끌어다 놓아야 한다.
// 양 끝단만 줄인다.
//
// 순수 함수로 유지할 것. db.js 는 모듈 최상단에서 firebase 를 import 하므로
// 여기서 import 하면 테스트 하네스가 Firebase 설정을 끌고 오게 된다.

const HHMM = /^(\d{1,2}):([0-5]\d)$/;
const DAY = 24 * 60;

// 항상 최소한 이만큼은 그린다. 일정을 추가해도 이 범위가 좁아지지 않는다.
// slotMaxTime 은 마지막 행의 "경계"라 24:00 이어야 23:00(오후 11시) 라벨이 보인다.
// 23:00 으로 두면 마지막 라벨이 22:00 이 되어 오후 11시가 안 보인다.
export const BASELINE_MIN_MINUTES = 7 * 60;    // 07:00 라벨부터
export const BASELINE_MAX_MINUTES = 24 * 60;   // 23:00 라벨까지 (경계는 24:00)
export const DEFAULT_PAD_MINUTES = 60;

/** "HH:MM" → 자정 이후 분. 형식 위반이면 null. "24:00" → 1440. */
export function parseHM(value) {
    if (typeof value !== 'string') return null;
    const m = HHMM.exec(value.trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 24 || (h === 24 && min > 0)) return null;
    return h * 60 + min;
}

/** 분 → "HH:MM:00". 1440 → "24:00:00" (FC 의 최대값). */
export const minutesToHMS = (mins) =>
    `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}:00`;

/**
 * 활동이 그리드에서 차지하는 분 구간.
 *
 * CalendarView 의 이벤트 생성 규칙과 반드시 일치해야 한다. 어긋나면 활동이
 * [slotMinTime, slotMaxTime] 밖으로 나가 조용히 사라진다:
 *   date 없음      → null (미배치, 렌더 안 됨)
 *   startTime 없음 → 00:00 (CalendarView 가 `${date}T00:00:00` 로 폴백)
 *   endTime 이 없거나 start 이하 → start + 60분 (CalendarView 의 1시간 폴백)
 */
export function activitySpanMinutes(act) {
    if (!act || !act.date) return null;
    const start = Math.min(parseHM(act.startTime) ?? 0, DAY);
    let end = parseHM(act.endTime);
    // end <= start 는 자정 넘김이거나 깨진 값. timeGrid 는 어차피 넘김을
    // 못 그리므로 1시간짜리로 보고 그날 안에 가둔다.
    if (end === null || end <= start) end = start + 60;
    return { start, end: Math.min(end, DAY) };
}

/**
 * 활동 배열 → { slotMinTime, slotMaxTime } ("HH:MM:00" 문자열).
 *
 * 기준선 07:00~24:00 을 깔고 **넓히기만** 한다. 범위 밖 일정(이른 비행기 등)이
 * 있으면 그쪽으로만 늘어나고, 일정이 몰려 있다고 해서 좁아지지는 않는다.
 *
 * 좁아지게 두면 일정을 하나 추가하는 순간 그리드가 그 일정 주변 몇 시간으로
 * 확 줄어 계획을 이어가기가 어렵다. 빈 시간대를 잘라 얻는 픽셀보다
 * "화면이 예측 가능하게 유지되는 것" 이 더 중요하다.
 */
export function computeTimeWindow(activities, {
    pad = DEFAULT_PAD_MINUTES
} = {}) {
    let lo = Infinity;
    let hi = -Infinity;

    for (const act of activities || []) {
        const span = activitySpanMinutes(act);
        if (!span) continue;
        if (span.start < lo) lo = span.start;
        if (span.end > hi) hi = span.end;
    }

    if (lo === Infinity) {
        return {
            slotMinTime: minutesToHMS(BASELINE_MIN_MINUTES),
            slotMaxTime: minutesToHMS(BASELINE_MAX_MINUTES)
        };
    }

    // 정시로 바깥쪽 스냅. slotLabelInterval 이 1시간이라 07:23 로 시작하면
    // 라벨이 07:23, 08:23 … 으로 붙어 깨져 보인다.
    lo = Math.floor((lo - pad) / 60) * 60;
    hi = Math.ceil((hi + pad) / 60) * 60;

    // 기준선을 깔고 넓히기만 한다.
    lo = Math.max(0, Math.min(BASELINE_MIN_MINUTES, lo));
    hi = Math.min(DAY, Math.max(BASELINE_MAX_MINUTES, hi));

    return { slotMinTime: minutesToHMS(lo), slotMaxTime: minutesToHMS(hi) };
}
