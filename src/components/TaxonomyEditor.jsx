import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { COLOR_PALETTE, DEFAULT_TAG_COLOR } from '../db';

// 태그·지역 공용 편집기 (추가 / 이름변경 / 색상 / 삭제).
//
// AdminView 에 태그용으로만 있던 90줄 JSX 를 추출한 것. 지역이 같은 UI 를
// 필요로 해서, 복붙하면 rename cascade 를 부르는 자리가 두 벌이 된다.
//
// props
//   items     : {name, color}[]  — normalizeTags 를 통과한 목록
//   onPersist : (nextItems) => Promise  — 목록 자체가 바뀔 때 (추가/삭제/색상)
//   onRename  : (oldName, newName) => Promise — 이름 변경. 참조 cascade 는 호출부 책임
//   emptyAction : 목록이 비었을 때 보여줄 노드 (예: 기본 태그 시드 버튼)
export default function TaxonomyEditor({ icon, label, placeholder, items = [], onPersist, onRename, emptyAction }) {
    const [newInput, setNewInput] = useState('');
    const [editing, setEditing] = useState(null);
    const [editingValue, setEditingValue] = useState('');
    const [colorPickerFor, setColorPickerFor] = useState(null);

    const handleAdd = async (e) => {
        e.preventDefault();
        const t = newInput.trim();
        if (!t) return;
        if (items.some(x => x.name === t)) {
            setNewInput('');
            return;
        }
        await onPersist([...items, { name: t, color: DEFAULT_TAG_COLOR }]);
        setNewInput('');
    };

    const handleRemove = async (item) => {
        if (!confirm(`"${item.name}" ${label}을(를) 삭제하시겠습니까? (적용된 항목은 표시 이름만 남습니다.)`)) return;
        await onPersist(items.filter(x => x.name !== item.name));
    };

    const handleColor = async (name, color) => {
        await onPersist(items.map(x => x.name === name ? { ...x, color } : x));
        setColorPickerFor(null);
    };

    return (
        <div className="trip-tag-row">
            <span className="trip-tag-row-label">
                {icon} {label}
            </span>
            <div className="trip-tag-list">
                {items.map(item => (
                    <span key={item.name} className="trip-tag-pill" style={{ borderColor: item.color }}>
                        <button
                            type="button"
                            className="trip-tag-swatch"
                            style={{ background: item.color }}
                            onClick={() => setColorPickerFor(colorPickerFor === item.name ? null : item.name)}
                            title="색상 변경"
                            aria-label={`${item.name} 색상 변경`}
                        />
                        {colorPickerFor === item.name && (
                            <div className="trip-tag-color-popover">
                                {COLOR_PALETTE.map(c => (
                                    <button
                                        key={c.value}
                                        type="button"
                                        className={`trip-tag-color-option${item.color === c.value ? ' is-selected' : ''}`}
                                        style={{ background: c.value }}
                                        onClick={() => handleColor(item.name, c.value)}
                                        title={c.name}
                                        aria-label={c.name}
                                    />
                                ))}
                            </div>
                        )}
                        {editing === item.name ? (
                            <input
                                type="text"
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                onBlur={() => {
                                    onRename(item.name, editingValue);
                                    setEditing(null);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') e.target.blur();
                                    if (e.key === 'Escape') setEditing(null);
                                }}
                                autoFocus
                                className="trip-tag-rename-input"
                            />
                        ) : (
                            <button
                                type="button"
                                className="trip-tag-name"
                                onClick={() => {
                                    setEditing(item.name);
                                    setEditingValue(item.name);
                                }}
                                title="클릭하면 이름 수정"
                            >{item.name}</button>
                        )}
                        <button
                            type="button"
                            className="trip-tag-remove"
                            onClick={() => handleRemove(item)}
                            title="삭제"
                        ><X size={12} /></button>
                    </span>
                ))}
                {items.length === 0 && emptyAction}
            </div>
            <form className="trip-tag-add" onSubmit={handleAdd}>
                <input
                    type="text"
                    value={newInput}
                    onChange={(e) => setNewInput(e.target.value)}
                    placeholder={placeholder}
                    className="trip-tag-input"
                />
                <button type="submit" className="btn btn-ghost btn-sm" title="추가">
                    <Plus size={14} />
                </button>
            </form>
        </div>
    );
}
