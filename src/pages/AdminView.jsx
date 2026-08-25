import React, { useState, useEffect, useRef } from 'react';
import { replaceTripActivities, exportToCSV, parseCSV, generateId, saveTrip, deleteTrip, saveCandidate, deleteCandidate, saveActivity, DEFAULT_TAGS, normalizeTags, resolveActivityColor } from '../db';
import { Download, Upload, Plus, Trash2, Save, Trash, MapPin, Link as LinkIcon, ExternalLink, Tag, ChevronDown, ChevronUp, Pencil, Map as MapIcon } from 'lucide-react';
import { Draggable } from '@fullcalendar/interaction';
import CalendarView from './CalendarView';
import CandidateModal from '../components/CandidateModal';
import { getDensityPreference, setDensityPreference } from '../density';
import TaxonomyEditor from '../components/TaxonomyEditor';
import './AdminView.css';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const computeTripDuration = (start, end) => {
    if (!start || !end) return 0;
    const [sy, sm, sd] = start.split('-').map(Number);
    const [ey, em, ed] = end.split('-').map(Number);
    const startMs = Date.UTC(sy, sm - 1, sd);
    const endMs = Date.UTC(ey, em - 1, ed);
    if (endMs < startMs) return 0;
    return Math.floor((endMs - startMs) / 86400000) + 1;
};

const formatTripDateLabel = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const wd = WEEKDAYS[new Date(y, m - 1, d).getDay()];
    return `${m}/${d} (${wd})`;
};

export default function AdminView({ dbData, refreshDb, selectedTripId: initialTripId, onUnschedule }) {
    const initialTrip = dbData.trips.find(t => t.id === (initialTripId || dbData.trips[0]?.id));
    const [selectedTripId, setSelectedTripId] = useState(initialTripId || dbData.trips[0]?.id || '');
    const [selectedTripTitle, setSelectedTripTitle] = useState(initialTrip?.title || '');
    const [tripStartDate, setTripStartDate] = useState(initialTrip?.startDate || '');
    const [tripEndDate, setTripEndDate] = useState(initialTrip?.endDate || '');

    // 추가·수정 모두 CandidateModal 이 처리한다. 신규는 id 에 `new_` prefix.
    const [editingCandidate, setEditingCandidate] = useState(null);
    const [headerExpanded, setHeaderExpanded] = useState(false);
    const [viewMode, setViewMode] = useState(() => {
        const tr = dbData.trips.find(t => t.id === (initialTripId || dbData.trips[0]?.id));
        const sd = tr?.startDate || '';
        const ed = tr?.endDate || '';
        if (!sd || !ed) return 'week';
        const [sy, sm, sdd] = sd.split('-').map(Number);
        const [ey, em, edd] = ed.split('-').map(Number);
        return Date.UTC(ey, em - 1, edd) >= Date.UTC(sy, sm - 1, sdd) ? 'trip' : 'week';
    });

    // 캘린더 행 밀도. 기기별 취향이라 localStorage 에 남긴다(density.js 주석 참고).
    // theme.js 소비 패턴과 동일 — lazy 초기화 + 핸들러에서 명령형 쓰기 후 setState.
    const [density, setDensity] = useState(getDensityPreference);
    const changeDensity = (d) => {
        setDensityPreference(d);
        setDensity(d);
    };

    // Was useState — but toggling state on every wishlist boundary crossing
    // forced an AdminView+CalendarView re-render mid-drag, which rebuilt
    // FullCalendar's events array and snapped the drag mirror away from
    // the cursor. Direct DOM toggling sidesteps React entirely.
    const sidebarRef = useRef(null);

    // v21: 미러를 더 이상 건드리지 않는다.
    //
    // v8~v20 이 20번 실패한 진짜 원인은 FC 가 아니라 CSS 였다. 미러는
    // position:fixed 인데 FC 가 이걸 `elementClosest(origTarget, '.fc')` 아래에
    // 붙인다(interaction/index.js:1255). 그런데 그 조상인
    // `<main class="container animate-slide-up">` 는 `animation: slideUp ...
    // forwards` 가 끝난 뒤에도 `transform: translateY(0)` 을 남기고,
    // **transform 이 걸린 요소는 position:fixed 의 포함 블록이 된다.**
    // 그래서 미러의 left/top 이 viewport 가 아니라 container 기준으로 풀렸고,
    // container 가 가운데 정렬이라 창이 넓을수록(maximized) 오차가 커졌다.
    // "미러가 커서와 어긋난다"는 증상의 전부가 이것이었다.
    //
    // 해법은 CalendarView 의 `fixedMirrorParent={document.body}` — 미러를
    // body 에 붙여 포함 블록을 viewport 로 되돌린다. 미러가 커서를 정확히
    // 따라오므로 여기서 숨길 이유가 사라졌고, 숨기기(=미러 DOM 조작)야말로
    // FC cleanup 을 깨뜨려 다음 드래그를 죽이던 원인이었다.
    const setSidebarDragOver = (over) => {
        sidebarRef.current?.classList.toggle('is-dragging-over', !!over);
    };

    // Initialize Draggable for candidates
    useEffect(() => {
        const draggableEl = document.getElementById('external-candidates');
        if (draggableEl) {
            const draggable = new Draggable(draggableEl, {
                itemSelector: '.candidate-item-draggable',
                eventData: function (eventEl) {
                    const data = JSON.parse(eventEl.getAttribute('data-event'));
                    return {
                        title: data.title,
                        create: true,
                        extendedProps: { ...data, isFromCandidate: true }
                    };
                }
            });
            return () => draggable.destroy();
        }
    }, [dbData.candidates]); // Re-init when list changes

    // Track when user is dragging FROM wishlist (vs INTO it). The hover-lift
    // on .candidate-item triggers a paint storm as the drag mirror passes
    // over each sibling. Killing the lift while a candidate is being
    // dragged restores 60fps inside the wishlist.
    useEffect(() => {
        const sidebar = sidebarRef.current;
        if (!sidebar) return;
        let active = false;
        const onDown = (e) => {
            if (!e.target.closest('.candidate-item-draggable')) return;
            active = true;
            sidebar.classList.add('is-dragging-from-wishlist');
        };
        const onUp = () => {
            if (!active) return;
            active = false;
            sidebar.classList.remove('is-dragging-from-wishlist');
        };
        sidebar.addEventListener('pointerdown', onDown);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        return () => {
            sidebar.removeEventListener('pointerdown', onDown);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
        };
    }, []);

    // Auto-save title + period
    useEffect(() => {
        if (!selectedTripId) return;
        const currentTrip = dbData.trips.find(t => t.id === selectedTripId);
        if (!currentTrip) return;
        const changed =
            currentTrip.title !== selectedTripTitle ||
            (currentTrip.startDate || '') !== tripStartDate ||
            (currentTrip.endDate || '') !== tripEndDate;
        if (!changed) return;

        const timeout = setTimeout(() => {
            saveTrip({
                ...currentTrip,
                title: selectedTripTitle,
                startDate: tripStartDate,
                endDate: tripEndDate
            }).then(() => refreshDb());
        }, 800);
        return () => clearTimeout(timeout);
    }, [selectedTripTitle, tripStartDate, tripEndDate, selectedTripId, dbData.trips, refreshDb]);

    const handleTripSelect = (id) => {
        setSelectedTripId(id);
        const trip = dbData.trips.find(t => t.id === id);
        setSelectedTripTitle(trip?.title || '');
        setTripStartDate(trip?.startDate || '');
        setTripEndDate(trip?.endDate || '');
    };

    const handleExport = () => {
        const activitiesToExport = dbData.activities.filter(a => a.tripId === selectedTripId);
        if (activitiesToExport.length === 0) {
            alert("내보낼 일정이 없습니다.");
            return;
        }
        exportToCSV(activitiesToExport);
    };

    const handleImport = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedTripId) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const parsed = parseCSV(evt.target.result, selectedTripId);
                await replaceTripActivities(selectedTripId, parsed);
                await refreshDb();
                alert('일정을 성공적으로 불러왔습니다!');
            } catch {
                alert('CSV 불러오기 실패: 올바른 형식인지 확인하세요.');
            }
        };
        reader.readAsText(file);
    };

    const handleAddNewTrip = async () => {
        const title = prompt('새로운 여행 이름을 입력하세요:', '2025 새로운 여행');
        if (!title) return;
        const newTrip = { id: generateId(), title, startDate: '', endDate: '' };
        await saveTrip(newTrip);
        await refreshDb();
        setSelectedTripId(newTrip.id);
        setSelectedTripTitle(title);
        setTripStartDate('');
        setTripEndDate('');
    };

    const handleOpenNewCandidate = () => {
        if (!selectedTripId) return;
        setEditingCandidate({
            id: `new_${generateId()}`,
            tripId: selectedTripId,
            title: '',
            url: '',
            notes: '',
            imageUrl: '',
            tag: '',
            area: ''
        });
    };

    const handleSaveCandidate = async (form) => {
        if (!editingCandidate) return;
        const { id } = editingCandidate;
        // saveCandidate 는 setDoc 전체 덮어쓰기라 기존 id 로 부르면 그대로 update 가 된다.
        const toSave = {
            ...editingCandidate,
            ...form,
            id: id.startsWith('new_') ? id.replace('new_', '') : id,
            tripId: selectedTripId
        };
        try {
            await saveCandidate(toSave);
            await refreshDb();
            setEditingCandidate(null);
        } catch (e) {
            alert('저장 실패: ' + e.message);
        }
    };

    const handleDeleteCandidate = async (id) => {
        if (!confirm('이 항목을 위시리스트에서 삭제하시겠습니까?')) return;
        try {
            await deleteCandidate(id);
            await refreshDb();
            setEditingCandidate(null);
        } catch (e) {
            alert('삭제 실패: ' + e.message);
        }
    };

    const currentCandidates = (dbData.candidates || []).filter(c => c.tripId === selectedTripId);

    const tripDuration = computeTripDuration(tripStartDate, tripEndDate);

    const handleDeleteTrip = async () => {
        if (!selectedTripId) return;
        if (!confirm('정말로 이 여행과 관련된 모든 일정을 삭제하시겠습니까?')) return;
        const next = dbData.trips.find(t => t.id !== selectedTripId);
        await deleteTrip(selectedTripId);
        await refreshDb();
        setSelectedTripId(next?.id || '');
        setSelectedTripTitle(next?.title || '');
        setTripStartDate(next?.startDate || '');
        setTripEndDate(next?.endDate || '');
    };

    // ─── Taxonomy (태그 / 지역) ──────────────────────────
    // 둘은 완전히 같은 모양이라 저장·이름변경 로직을 한 벌로 묶었다.
    const currentTrip = dbData.trips.find(t => t.id === selectedTripId);
    const currentTags = normalizeTags(currentTrip?.tags);
    const currentAreas = normalizeTags(currentTrip?.areas);

    // 자동저장 useEffect 와 경쟁하지 않도록 편집 중인 제목/기간을 항상 함께 쓴다.
    const persistTrip = async (patch) => {
        if (!currentTrip) return;
        await saveTrip({
            ...currentTrip,
            title: selectedTripTitle,
            startDate: tripStartDate,
            endDate: tripEndDate,
            ...patch
        });
        await refreshDb();
    };

    const persistTags = (tags) => persistTrip({ tags });
    const persistAreas = (areas) => persistTrip({ areas });

    // 이름을 바꾸면 그 이름을 참조하는 활동·후보지를 전부 갱신해야 한다.
    // 빠뜨리면 이름만 바뀌고 참조가 옛 이름에 남아 색상 해석이 실패한다.
    const renameTaxonomy = async (field, listKey, list, oldName, newName) => {
        const trimmed = newName.trim();
        if (!trimmed || trimmed === oldName) return;
        if (list.some(t => t.name === trimmed)) {
            alert(`"${trimmed}" 항목이 이미 있습니다.`);
            return;
        }
        const nextList = list.map(t => t.name === oldName ? { ...t, name: trimmed } : t);
        const acts = dbData.activities.filter(a => a.tripId === selectedTripId && a[field] === oldName);
        const cands = (dbData.candidates || []).filter(c => c.tripId === selectedTripId && c[field] === oldName);
        await Promise.all([
            saveTrip({
                ...currentTrip,
                title: selectedTripTitle,
                startDate: tripStartDate,
                endDate: tripEndDate,
                [listKey]: nextList
            }),
            ...acts.map(a => saveActivity({ ...a, [field]: trimmed })),
            ...cands.map(c => saveCandidate({ ...c, [field]: trimmed }))
        ]);
        await refreshDb();
    };

    const handleRenameTag = (oldName, newName) =>
        renameTaxonomy('tag', 'tags', currentTags, oldName, newName);
    const handleRenameArea = (oldName, newName) =>
        renameTaxonomy('area', 'areas', currentAreas, oldName, newName);

    // View-mode safety: drop back to weekly view if the trip period is cleared.
    const hasTripPeriod = tripDuration > 0;
    useEffect(() => {
        if (viewMode === 'trip' && !hasTripPeriod) setViewMode('week');
    }, [viewMode, hasTripPeriod]);

    // Click outside the trip-settings popover (backdrop, toggle button, or
    // popover content) closes it. The backdrop's onClick handles most cases;
    // this guards against e.g. ESC-equivalent stray clicks.
    useEffect(() => {
        if (!headerExpanded) return;
        const handler = (e) => {
            if (e.target.closest('.trip-settings-toggle-area')) return;
            if (e.target.closest('.trip-settings-popover')) return;
            setHeaderExpanded(false);
        };
        const t = setTimeout(() => document.addEventListener('mousedown', handler), 0);
        return () => {
            clearTimeout(t);
            document.removeEventListener('mousedown', handler);
        };
    }, [headerExpanded]);

    const tripSettingsPanel = (
        <div className="trip-settings-panel">
                <div className="trip-manager">
                    <div className="trip-manager-row">
                        <select
                            value={selectedTripId}
                            onChange={(e) => handleTripSelect(e.target.value)}
                            className="trip-selector-admin"
                        >
                            {dbData.trips.map(t => (
                                <option key={t.id} value={t.id}>{t.title}</option>
                            ))}
                        </select>
                        <input
                            type="text"
                            value={selectedTripTitle}
                            onChange={(e) => setSelectedTripTitle(e.target.value)}
                            placeholder="여행 이름 수정"
                            className="trip-title-input"
                        />
                        <button className="btn btn-ghost" onClick={handleAddNewTrip} title="New Trip">
                            <Plus size={16} />
                        </button>
                        <button className="btn btn-ghost danger" onClick={handleDeleteTrip} title="Delete Trip">
                            <Trash size={16} />
                        </button>
                    </div>
                    <div className="trip-period-row">
                        <label className="trip-period-field">
                            <span className="trip-period-label">시작</span>
                            <input
                                type="date"
                                value={tripStartDate}
                                onChange={(e) => setTripStartDate(e.target.value)}
                                className="trip-date-input"
                            />
                        </label>
                        <span className="trip-period-arrow">→</span>
                        <label className="trip-period-field">
                            <span className="trip-period-label">종료</span>
                            <input
                                type="date"
                                value={tripEndDate}
                                onChange={(e) => setTripEndDate(e.target.value)}
                                className="trip-date-input"
                                min={tripStartDate || undefined}
                            />
                        </label>
                        <span className="trip-period-summary">
                            {tripDuration > 0
                                ? `총 ${tripDuration}일 · ${formatTripDateLabel(tripStartDate)} ~ ${formatTripDateLabel(tripEndDate)}`
                                : '여행 기간을 설정하면 일정이 그 범위로 표시됩니다.'}
                        </span>
                    </div>
                    <TaxonomyEditor
                        icon={<Tag size={14} />}
                        label="태그"
                        placeholder="새 태그"
                        items={currentTags}
                        onPersist={persistTags}
                        onRename={handleRenameTag}
                        emptyAction={
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => persistTags([...DEFAULT_TAGS])}
                            >
                                기본 태그 추가 ({DEFAULT_TAGS.map(t => t.name).join(', ')})
                            </button>
                        }
                    />

                    {/* 지역: '고성·속초·아사쿠사' 같은 구역. 위시리스트를 이걸로 묶는다.
                        기본 시드는 없다 — 여행마다 완전히 다르다. */}
                    <TaxonomyEditor
                        icon={<MapIcon size={14} />}
                        label="지역"
                        placeholder="새 지역 (예: 고성)"
                        items={currentAreas}
                        onPersist={persistAreas}
                        onRename={handleRenameArea}
                    />
                </div>

                <div className="admin-actions">
                    <label className="btn btn-ghost file-upload">
                        <Upload size={16} /> <span className="hidden-mobile">CSV 덮어쓰기</span>
                        <input type="file" accept=".csv" onChange={handleImport} hidden />
                    </label>
                    <button className="btn btn-ghost" onClick={handleExport}>
                        <Download size={16} /> <span className="hidden-mobile">CSV 내보내기</span>
                    </button>
                </div>
        </div>
    );

    return (
        <div className="admin-page">
            <div className="admin-content-layout">
                <div className="calendar-integration-wrapper">
                    {selectedTripId ? (
                        <CalendarView
                            dbData={dbData}
                            selectedTripId={selectedTripId}
                            refreshDb={refreshDb}
                            onDragOverWishlist={setSidebarDragOver}
                            onUnschedule={onUnschedule}
                            viewMode={viewMode}
                            density={density}
                        />
                    ) : (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                            우측에서 여행을 선택하거나 추가해 주세요.
                        </div>
                    )}
                </div>

                <div className="right-column">
                    <div className="trip-settings-toggle-area">
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm trip-settings-toggle"
                            onClick={() => setHeaderExpanded(v => !v)}
                            title={headerExpanded ? '여행 설정 접기' : '여행 설정 펼치기'}
                        >
                            {headerExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            <span>여행 설정</span>
                        </button>
                    </div>
                    {headerExpanded && (
                        <>
                            <div
                                className="trip-settings-backdrop"
                                onClick={() => setHeaderExpanded(false)}
                                aria-hidden="true"
                            />
                            <div className="trip-settings-popover" role="dialog" aria-label="여행 설정">
                                {tripSettingsPanel}
                            </div>
                        </>
                    )}

                    <div className="view-mode-toggle">
                        <button
                            type="button"
                            className={`btn btn-sm ${viewMode === 'week' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setViewMode('week')}
                        >
                            주간 보기
                        </button>
                        <button
                            type="button"
                            className={`btn btn-sm ${viewMode === 'trip' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => hasTripPeriod && setViewMode('trip')}
                            disabled={!hasTripPeriod}
                            title={hasTripPeriod ? '' : '먼저 여행 기간을 설정하세요'}
                        >
                            여행 기간 {hasTripPeriod ? `(${tripDuration}일)` : ''}
                        </button>
                    </div>

                    {/* 밀도. .view-mode-toggle 을 재사용하면 .right-column 스코프의
                        세로 스택 + 전체 너비 스타일을 그대로 물려받는다. */}
                    <div className="view-mode-toggle">
                        <button
                            type="button"
                            className={`btn btn-sm ${density === 'comfortable' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => changeDensity('comfortable')}
                            title="15분 일정 제목까지 보이는 높이 (세로 스크롤)"
                        >
                            보통
                        </button>
                        <button
                            type="button"
                            className={`btn btn-sm ${density === 'fit' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => changeDensity('fit')}
                            title="하루 전체를 한 화면에 (짧은 일정은 색 막대)"
                        >
                            한눈에 보기
                        </button>
                    </div>

                    <div ref={sidebarRef} className="candidates-sidebar">
                    <div className="sidebar-header">
                        <MapPin size={18} />
                        <h3>가고 싶은 곳 (Wishlist)</h3>
                        <button
                            type="button"
                            className="candidate-add-btn"
                            onClick={handleOpenNewCandidate}
                            disabled={!selectedTripId}
                            title="장소 추가"
                            aria-label="장소 추가"
                        >
                            <Plus size={16} />
                        </button>
                    </div>

                    <div id="external-candidates" className="candidates-list">
                        {/* Always render — CSS visibility is toggled via the
                            sidebar's `is-dragging-over` class so we don't
                            mount/unmount during drag (would force a React
                            render and shake the FullCalendar drag mirror). */}
                        <div className="drop-placeholder">
                            <Plus size={24} />
                            <span>이곳에 놓으면 후보지로 이동합니다</span>
                        </div>
                        {currentCandidates.length === 0
                            ? <p className="hint">위 <strong>+</strong> 버튼으로 가고 싶은 곳을 추가하세요.</p>
                            : <p className="hint">💡 아래 항목을 달력으로 끌어다 놓으세요!</p>}
                        {/* 드래그 대상은 카드가 아니라 안쪽 래퍼다. FullCalendar 는
                            컨테이너의 네이티브 mousedown 에서 closest('.candidate-item-draggable')
                            로 대상을 찾으므로, 액션 버튼을 래퍼 바깥(형제)에 두면 버튼을 누른 채
                            흔들려도 드래그가 시작되지 않는다. React 합성 이벤트의
                            stopPropagation 은 루트 위임이라 이 시점엔 이미 늦어서 소용없다. */}
                        {currentCandidates.map(c => (
                            <div key={c.id} className="candidate-item">
                                <div
                                    className="candidate-item-draggable"
                                    data-event={JSON.stringify({
                                        ...c,
                                        imageUrl: c.imageUrl || ''
                                    })}
                                >
                                    {c.imageUrl && (
                                        <div className="candidate-thumbnail">
                                            <img src={c.imageUrl} alt={c.title} />
                                        </div>
                                    )}
                                    <div className="candidate-info">
                                        {c.tag && (
                                            <span
                                                className="candidate-tag"
                                                style={{ background: resolveActivityColor(c, currentTrip?.tags) || 'var(--primary)' }}
                                            >{c.tag}</span>
                                        )}
                                        <span className="candidate-title">{c.title}</span>
                                        {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /></a>}
                                    </div>
                                </div>
                                <div className="candidate-actions">
                                    <button
                                        type="button"
                                        className="candidate-action-btn"
                                        onClick={() => setEditingCandidate(c)}
                                        title="수정"
                                        aria-label={`${c.title} 수정`}
                                    >
                                        <Pencil size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        className="candidate-action-btn is-danger"
                                        onClick={() => handleDeleteCandidate(c.id)}
                                        title="삭제"
                                        aria-label={`${c.title} 삭제`}
                                    >
                                        <Trash size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                </div>
            </div>

            {editingCandidate && (
                <CandidateModal
                    key={editingCandidate.id}
                    candidate={editingCandidate}
                    onClose={() => setEditingCandidate(null)}
                    onSave={handleSaveCandidate}
                    onDelete={handleDeleteCandidate}
                    availableTags={currentTags}
                    availableAreas={currentAreas}
                />
            )}
        </div>
    );
}
