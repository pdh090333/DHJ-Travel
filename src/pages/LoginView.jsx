import React, { useState } from 'react';
import { Map as MapIcon, LogIn } from 'lucide-react';
import { signInWithGoogle, signOutUser } from '../auth';
import './LoginView.css';

export default function LoginView({ error, onRetry }) {
    const [busy, setBusy] = useState(false);
    const [localError, setLocalError] = useState(null);

    const handleSignIn = async () => {
        setBusy(true);
        setLocalError(null);
        try {
            await signInWithGoogle();
        } catch (e) {
            if (e?.code === 'auth/popup-closed-by-user') {
                // 사용자가 팝업을 닫음 — 별도 메시지 불필요
            } else {
                setLocalError(e?.message || '로그인 중 오류가 발생했습니다.');
            }
        } finally {
            setBusy(false);
        }
    };

    const handleSignOutAndRetry = async () => {
        await signOutUser();
        if (onRetry) onRetry();
    };

    const isUnauthorized = error === 'unauthorized';

    return (
        <div className="login-view">
            <div className="login-card">
                <div className="login-icon">
                    <MapIcon size={36} color="var(--primary)" />
                </div>
                <h1 className="login-title">DHJ 여행 일정표</h1>
                <p className="login-subtitle">
                    {isUnauthorized
                        ? '이 계정은 접근 권한이 없습니다.'
                        : '계속하려면 로그인하세요.'}
                </p>

                {isUnauthorized ? (
                    <>
                        <p className="login-hint">
                            허용된 Google 계정으로 다시 로그인해주세요.
                        </p>
                        <button
                            className="btn btn-primary login-btn"
                            onClick={handleSignOutAndRetry}
                        >
                            <LogIn size={18} />
                            다른 계정으로 로그인
                        </button>
                    </>
                ) : (
                    <button
                        className="btn btn-primary login-btn"
                        onClick={handleSignIn}
                        disabled={busy}
                    >
                        <LogIn size={18} />
                        {busy ? '로그인 중...' : 'Google 계정으로 로그인'}
                    </button>
                )}

                {localError && <p className="login-error">{localError}</p>}
            </div>
        </div>
    );
}
