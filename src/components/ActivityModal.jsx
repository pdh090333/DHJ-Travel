import React, { useState, useEffect } from 'react';
import { Star, Info } from 'lucide-react';
import './ActivityModal.css';

export default function ActivityModal({ activity, onClose, onSave, onDelete, onMoveToCandidates, availableTags = [] }) {
    const [formData, setFormData] = useState({
        title: '',
        date: '',
        startTime: '',
        endTime: '',
        departure: '',
        arrival: '',
        departureUrl: '',
        arrivalUrl: '',
        notes: '',
        imageUrl: '',
        reviewUrl: '',
        tag: ''
    });

    useEffect(() => {
        if (activity) {
            setFormData({
                ...activity,
                title: activity.title || '',
                departure: activity.departure || '',
                arrival: activity.arrival || '',
                departureUrl: activity.departureUrl || '',
                arrivalUrl: activity.arrivalUrl || '',
                notes: activity.notes || '',
                imageUrl: activity.imageUrl || '',
                reviewUrl: activity.reviewUrl || '',
                tag: activity.tag || ''
            });
        }
    }, [activity]);

    // availableTags arrives as [{name, color}, ...]. The dropdown only needs names.
    const tagNames = availableTags.map(t => t?.name || t);
    // If the saved tag is no longer in the trip's tag list (e.g. it was
    // deleted from the taxonomy), keep it as an option so the dropdown
    // doesn't silently drop the value.
    const tagOptions = formData.tag && !tagNames.includes(formData.tag)
        ? [...tagNames, formData.tag]
        : tagNames;

    const extractDirectImageUrl = (url) => {
        if (!url) return '';
        // If it's already a direct Google CDN link, return as is
        if (url.includes('lh3.googleusercontent.com')) return url;

        // Try to extract from Google Maps photo gallery URLs
        // Pattern: ...!6shttps[:%]+2F%2Flh3\.googleusercontent\.com%2F...
        const match = url.match(/!6s(https[:%][^!&]+lh3\.googleusercontent\.com[^!&]+)/);
        if (match) {
            let extracted = match[1];
            // Decode repeatedly if necessary to handle double encoding
            try {
                let decoded = decodeURIComponent(extracted);
                if (decoded.includes('%')) decoded = decodeURIComponent(decoded);
                return decoded;
            } catch (e) {
                return extracted;
            }
        }

        return url;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        let finalValue = value;

        if (name === 'imageUrl') {
            finalValue = extractDirectImageUrl(value);
        }

        setFormData(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    if (!activity) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content animate-slide-up">
                <div className="modal-header">
                    <h2>{activity.id.startsWith('new_') ? '일정 추가' : '일정 수정'}</h2>
                    <button className="btn-close" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="modal-body">
                    <div className="form-row">
                        <div className="form-group">
                            <label>날짜</label>
                            <input type="date" name="date" value={formData.date} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label>시작 시간</label>
                            <input type="time" name="startTime" value={formData.startTime} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label>종료 시간</label>
                            <input type="time" name="endTime" value={formData.endTime} onChange={handleChange} required />
                        </div>
                    </div>

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
                            <label>일정 제목</label>
                            <input type="text" name="title" value={formData.title} onChange={handleChange} placeholder="비행기 탑승, 호텔 체크인 등" required />
                        </div>
                    </div>

                    {/*
                      출발지 입력 (이름 + 구글맵 링크) — 사용 중지됨.
                      직전 일정의 도착지를 자동으로 출발지로 이어붙여 길찾기에 사용합니다.
                      복원 시 아래 두 form-row 주석 해제 + (선택) 도착지 ⓘ 안내 문구 조정.

                      <div className="form-row">
                          <div className="form-group">
                              <label>출발지 이름</label>
                              <input type="text" name="departure" value={formData.departure} onChange={handleChange} placeholder="인천공항" />
                          </div>
                          <div className="form-group">
                              <label>도착지 이름</label>
                              <input type="text" name="arrival" value={formData.arrival} onChange={handleChange} placeholder="나리타공항" />
                          </div>
                      </div>
                      <div className="form-row">
                          <div className="form-group">
                              <label>출발지 구글맵 링크</label>
                              <input type="url" name="departureUrl" value={formData.departureUrl} onChange={handleChange} placeholder="https://goo.gl/maps/..." />
                          </div>
                          <div className="form-group">
                              <label>도착지 구글맵 링크</label>
                              <input type="url" name="arrivalUrl" value={formData.arrivalUrl} onChange={handleChange} placeholder="https://goo.gl/maps/..." />
                          </div>
                      </div>
                    */}

                    <div className="form-group">
                        <label>
                            도착지 이름
                            <span
                                className="form-info-icon"
                                title="이 도착지가 다음 일정의 출발지로 자동 사용되어 길찾기됩니다. 출발지를 따로 입력하지 않습니다."
                                aria-label="이 도착지가 다음 일정의 출발지로 자동 사용되어 길찾기됩니다."
                            >
                                <Info size={14} />
                            </span>
                        </label>
                        <input type="text" name="arrival" value={formData.arrival} onChange={handleChange} placeholder="나리타공항" />
                    </div>

                    <div className="form-group">
                        <label>도착지 구글맵 링크</label>
                        <input type="url" name="arrivalUrl" value={formData.arrivalUrl} onChange={handleChange} placeholder="https://goo.gl/maps/..." />
                    </div>

                    <div className="form-group">
                        <label>이미지 URL (참고 사진)</label>
                        <input type="url" name="imageUrl" value={formData.imageUrl} onChange={handleChange} placeholder="https://... (이미지 주소)" />
                        {formData.imageUrl && (
                            <div className="modal-image-preview">
                                <img src={formData.imageUrl} alt="Preview" />
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <label>구글 맵 리뷰 링크 (선택)</label>
                        <input type="url" name="reviewUrl" value={formData.reviewUrl} onChange={handleChange} placeholder="https://maps.app.goo.gl/..." />
                    </div>

                    <div className="form-group">
                        <label>메모 (Notes)</label>
                        <textarea name="notes" value={formData.notes} onChange={handleChange} placeholder="예약 번호, 준비물 등" rows={3}></textarea>
                    </div>

                    <div className="modal-actions">
                        {!activity.id.startsWith('new_') && (
                            <div className="action-left-group">
                                <button type="button" className="btn btn-danger" onClick={() => onDelete(activity.id)}>
                                    삭제
                                </button>
                                <button type="button" className="btn btn-ghost" onClick={() => onMoveToCandidates(formData)}>
                                    <Star size={16} /> 후보지로 이동
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
