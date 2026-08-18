// 구글맵 사진 공유 URL에서 lh3.googleusercontent.com 직접 링크를 뽑아낸다.
//
// AdminView / ActivityModal 에 각각 복사돼 있던 것을 통합했다. 정본은
// AdminView 쪽 — 첫 가드에 `&& !url.includes('google.com/maps')` 가 붙어 있어
// 구글맵 URL 안에 lh3 링크가 인코딩돼 들어있는 경우도 추출까지 간다.
export const extractDirectImageUrl = (url) => {
    if (!url) return '';
    if (url.includes('lh3.googleusercontent.com') && !url.includes('google.com/maps')) return url;

    // Pattern: ...!6shttps[:%]+2F%2Flh3\.googleusercontent\.com%2F...
    const match = url.match(/!6s(https[:%][^!&]+lh3\.googleusercontent\.com[^!&]+)/);
    if (match) {
        try {
            // 이중 인코딩된 경우가 있어 필요하면 한 번 더 디코드
            let decoded = decodeURIComponent(match[1]);
            if (decoded.includes('%')) decoded = decodeURIComponent(decoded);
            return decoded;
        } catch {
            return match[1];
        }
    }

    return url;
};
