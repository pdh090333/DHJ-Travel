import React from 'react';

// 태그·지역처럼 {name, color}[] 목록에서 하나를 고르는 드롭다운.
// ActivityModal / CandidateModal 두 곳 x 두 축(태그·지역) = 4곳에서 쓴다.
export default function TaxonomySelect({ label, name, value, options = [], onChange, width = '8rem' }) {
    const names = options.map(o => o?.name || o);
    // 저장된 값이 목록에서 사라진 경우(taxonomy 에서 삭제됨)에도 옵션으로 남겨서
    // 드롭다운이 값을 조용히 날려버리지 않게 한다.
    const list = value && !names.includes(value) ? [...names, value] : names;

    return (
        <div className="form-group" style={{ flex: `0 0 ${width}` }}>
            <label>{label}</label>
            <select name={name} value={value} onChange={onChange}>
                <option value="">(없음)</option>
                {list.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
        </div>
    );
}
