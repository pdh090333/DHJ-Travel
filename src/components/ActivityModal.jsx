import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import './ActivityModal.css';

export default function ActivityModal({ activity, onClose, onSave, onDelete, onMoveToCandidates }) {
    const [formData, setFormData] = useState({
        title: '',
        date: '',
        startTime: '',
        endTime: '',
        departure: '',
        arrival: '',
        departureUrl: '',
        arrivalUrl: '',
        notes: ''
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
                notes: activity.notes || ''
            });
        }
    }, [activity]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
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

                    <div className="form-group">
                        <label>일정 제목</label>
                        <input type="text" name="title" value={formData.title} onChange={handleChange} placeholder="비행기 탑승, 호텔 체크인 등" required />
                    </div>

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
