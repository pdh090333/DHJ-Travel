import React, { useState } from 'react';
import { Trash } from 'lucide-react';
import { extractDirectImageUrl } from '../utils/imageUtils';
import './ActivityModal.css';

// 위시리스트(후보지) 추가 · 수정 겸용 모달.
// 신규 여부는 ActivityModal 과 같은 `new_` prefix 센티널로 구분한다.
//
// ActivityModal 처럼 useEffect 로 시딩하지 않고 lazy initializer 를 쓴다.
// AdminView 가 key={candidate.id} 로 마운트하므로 대상이 바뀌면 리마운트되어
// 다시 시딩된다 — 결과는 같으면서 react-hooks/set-state-in-effect 를 피한다.
export default function CandidateModal({ candidate, onClose, onSave, onDelete, availableTags = [] }) {
    const [formData, setFormData] = useState(() => ({
        title: candidate?.title || '',
        url: candidate?.url || '',
        imageUrl: candidate?.imageUrl || '',
        notes: candidate?.notes || '',
        tag: candidate?.tag || ''
    }));

    // availableTags 는 [{name, color}, ...]. 드롭다운은 이름만 필요하다.
    const tagNames = availableTags.map(t => t?.name || t);
    // 저장된 태그가 여행의 태그 목록에서 사라진 경우(taxonomy 에서 삭제됨)에도
    // 옵션으로 남겨서 드롭다운이 값을 조용히 날려버리지 않게 한다.
    const tagOptions = formData.tag && !tagNames.includes(formData.tag)
        ? [...tagNames, formData.tag]
        : tagNames;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'imageUrl' ? extractDirectImageUrl(value) : value
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // required 는 공백만 있는 값을 통과시킨다
        const title = formData.title.trim();
        if (!title) return;
        onSave({ ...formData, title });
    };

    if (!candidate) return null;
    const isNew = candidate.id.startsWith('new_');

    return (
        <div className="modal-overlay">
            <div className="modal-content animate-slide-up">
                <div className="modal-header">
                    <h2>{isNew ? '가고 싶은 곳 추가' : '가고 싶은 곳 수정'}</h2>
                    <button className="btn-close" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="modal-body">
                    <div className="form-row">
                        <div className="form-group" style={{ flex: '0 0 8rem' }}>
                            <label>태그</label>
                            <select name="tag" value={formData.tag} onChange={handleChange}>
                                <option value="">(없음)</option>
                                {tagOptions.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>장소 이름</label>
                            <input
                                type="text"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                placeholder="센소지, 이치란 라멘 등"
                                autoFocus
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>구글맵 링크 (선택)</label>
                        <input
                            type="url"
                            name="url"
                            value={formData.url}
                            onChange={handleChange}
                            placeholder="https://maps.app.goo.gl/..."
                        />
                    </div>

                    <div className="form-group">
                        <label>이미지 URL (선택)</label>
                        <input
                            type="url"
                            name="imageUrl"
                            value={formData.imageUrl}
                            onChange={handleChange}
                            placeholder="https://... (이미지 주소)"
                        />
                        {formData.imageUrl && (
                            <div className="modal-image-preview">
                                <img src={formData.imageUrl} alt="Preview" />
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <label>메모 (선택)</label>
                        <textarea
                            name="notes"
                            value={formData.notes}
                            onChange={handleChange}
                            placeholder="영업시간, 예약 여부, 추천 메뉴 등"
                            rows={6}
                        ></textarea>
                    </div>

                    <div className="modal-actions">
                        {/* .modal-actions 는 space-between 이라, 신규일 때도 빈 칸을
                            채워야 저장 버튼이 오른쪽에 남는다. */}
                        {isNew ? <div /> : (
                            <div className="action-left-group">
                                <button type="button" className="btn btn-danger" onClick={() => onDelete(candidate.id)}>
                                    <Trash size={16} /> 삭제
                                </button>
                            </div>
                        )}
                        <div className="action-right">
                            <button type="button" className="btn btn-ghost" onClick={onClose}>취소</button>
                            <button type="submit" className="btn btn-primary">저장하기</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
