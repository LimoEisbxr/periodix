import { useState } from 'react';
import { api } from '../api';
import type { User } from '../types';
import RequestAccessModal from './RequestAccessModal';
import PendingAccessRequestModal from './PendingAccessRequestModal';

export default function Login({
    onAuth,
}: {
    onAuth: (token: string, user: User) => void;
}) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showRequestAccessModal, setShowRequestAccessModal] = useState(false);
    const [showPendingAccessModal, setShowPendingAccessModal] = useState(false);
    const [pendingRequestedAt, setPendingRequestedAt] = useState<
        string | undefined
    >(undefined);

    const modalOpen = showRequestAccessModal || showPendingAccessModal;

    async function submit() {
        if (modalOpen) return; // Block submissions while a modal is open
        setLoading(true);
        setError(null);
        try {
            const body = {
                username,
                password,
            };
            const res = await api<{ token: string; user: User }>(
                `/api/auth/login`,
                { method: 'POST', body: JSON.stringify(body) }
            );
            onAuth(res.token, res.user);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);

            // Check if this is a whitelist error by looking for the error message
            // Raw message may be JSON or plain text; attempt to parse
            let parsed: unknown = null;
            try {
                parsed = JSON.parse(msg);
            } catch {
                // Non-JSON error message
            }
            const p = parsed as {
                error?: string;
                code?: string;
                requestedAt?: string;
            } | null;
            const errorStr = typeof p?.error === 'string' ? p.error : msg;
            const codeStr =
                p?.code ||
                (typeof p?.error === 'string' &&
                p.error.includes('NOT_WHITELISTED')
                    ? 'NOT_WHITELISTED'
                    : undefined);

            if (
                codeStr === 'ACCESS_REQUEST_PENDING' ||
                errorStr.includes('ACCESS_REQUEST_PENDING') ||
                errorStr.toLowerCase().includes('already pending')
            ) {
                setPendingRequestedAt(p?.requestedAt);
                setShowPendingAccessModal(true);
                return;
            }
            if (
                codeStr === 'NOT_WHITELISTED' ||
                errorStr.includes('NOT_WHITELISTED') ||
                errorStr.includes('not authorized for this beta')
            ) {
                setShowRequestAccessModal(true);
                return;
            }

            // Try to parse JSON error response from the API
            let errorMessage = 'An error occurred during sign in';
            let errorCode: string | null = null;

            try {
                const errorData = JSON.parse(msg);
                if (errorData.error) {
                    errorMessage = errorData.error;
                    errorCode = errorData.code;
                }
            } catch {
                // If not JSON, use the raw message
                errorMessage = msg || 'Failed';
            }

            // Provide user-friendly messages for specific error codes
            if (errorCode === 'BAD_CREDENTIALS') {
                errorMessage =
                    'Invalid username or password. Please check your Untis credentials and try again.';
            } else if (errorCode === 'UNTIS_LOGIN_FAILED') {
                errorMessage =
                    'Unable to connect to Untis. Please try again later.';
            }

            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="relative min-h-screen flex items-center justify-center px-4 py-8 overflow-hidden text-slate-100">
            <div className="absolute inset-0 -z-10">
                <div className="absolute inset-0 bg-slate-950" />
                <div className="absolute -top-32 -left-32 w-[40rem] h-[40rem] bg-indigo-600/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-32 -right-24 w-[38rem] h-[38rem] bg-emerald-600/20 rounded-full blur-3xl" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60rem] h-[60rem] bg-sky-500/10 rounded-full blur-[140px]" />
            </div>
            <div className="relative w-full max-w-md">
                <div className="relative group rounded-3xl p-[2px] bg-gradient-to-br from-indigo-500/60 via-sky-500/60 to-emerald-500/60 shadow-2xl shadow-slate-950/50 overflow-hidden">
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_60%)]" />
                        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(99,102,241,0.15),rgba(56,189,248,0.12),rgba(16,185,129,0.15))] mix-blend-overlay" />
                    </div>
                    <div className="relative rounded-[calc(1.5rem-2px)] bg-slate-900/85 backdrop-blur-xl px-8 py-10 overflow-hidden">
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute -top-40 -right-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl" />
                            <div className="absolute -bottom-40 -left-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl" />
                        </div>
                        <div className="relative flex items-center gap-4 mb-8">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 via-sky-500 to-emerald-500 p-[2px] shadow-lg">
                                <div className="w-full h-full rounded-[1rem] bg-slate-950 flex items-center justify-center">
                                    <svg
                                        className="w-8 h-8 text-sky-300"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M12 6v6l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                </div>
                            </div>
                            <div>
                                <h1 className="text-3xl font-semibold bg-gradient-to-r from-indigo-300 via-sky-300 to-emerald-300 bg-clip-text text-transparent tracking-tight">
                                    Periodix
                                </h1>
                                <p className="mt-1 text-sm text-slate-400 tracking-wide">
                                    Sign in with your Untis credentials
                                </p>
                            </div>
                        </div>
                        <form
                            className="space-y-4"
                            onSubmit={(e) => {
                                e.preventDefault();
                                if (!loading && !modalOpen) void submit();
                            }}
                            // Some older Android WebView / PWA contexts occasionally miss Enter submit.
                            onKeyDown={(e) => {
                                if (
                                    e.key === 'Enter' &&
                                    (e.metaKey || e.ctrlKey)
                                ) {
                                    // Allow Cmd/Ctrl+Enter as explicit submit too.
                                    (
                                        e.currentTarget as HTMLFormElement
                                    ).requestSubmit();
                                }
                            }}
                        >
                            <div>
                                <label
                                    htmlFor="login-username"
                                    className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-2"
                                >
                                    Username
                                </label>
                                <input
                                    id="login-username"
                                    className="input bg-slate-800/70 border-slate-700 focus:ring-sky-500/60 focus:border-sky-500 placeholder:text-slate-500"
                                    placeholder="your username"
                                    value={username}
                                    onChange={(e) =>
                                        setUsername(e.target.value)
                                    }
                                    autoComplete="username"
                                    required
                                    onKeyDown={(e) => {
                                        if (modalOpen && e.key === 'Enter') {
                                            e.preventDefault();
                                            return;
                                        }
                                        if (e.key === 'Enter') {
                                            // If password empty, move focus to password instead of submitting prematurely.
                                            if (!password) {
                                                e.preventDefault();
                                                const pw =
                                                    document.getElementById(
                                                        'login-password'
                                                    );
                                                pw?.focus();
                                            }
                                        }
                                    }}
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="login-password"
                                    className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-2"
                                >
                                    Password
                                </label>
                                <input
                                    id="login-password"
                                    className="input bg-slate-800/70 border-slate-700 focus:ring-sky-500/60 focus:border-sky-500 placeholder:text-slate-500"
                                    type="password"
                                    placeholder="your password"
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    autoComplete="current-password"
                                    required
                                    onKeyDown={(e) => {
                                        if (modalOpen && e.key === 'Enter') {
                                            e.preventDefault();
                                            return;
                                        }
                                        if (e.key === 'Enter') {
                                            // Let the form submit normally
                                            // but ensure we don't double-trigger via button onClick
                                            // (button is type=submit so it's fine)
                                        }
                                    }}
                                />
                            </div>
                            {error && (
                                <div
                                    role="alert"
                                    aria-live="assertive"
                                    className="rounded-xl border border-red-500/40 bg-red-500/10 backdrop-blur-sm p-3 text-sm text-red-300 shadow-inner"
                                >
                                    <div className="flex items-start gap-2">
                                        <svg
                                            className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-400"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M12 9v2m0 4h.01M4.93 4.93l14.14 14.14M12 2a10 10 0 100 20 10 10 0 000-20z"
                                            />
                                        </svg>
                                        <span className="leading-relaxed">
                                            {error}
                                        </span>
                                    </div>
                                </div>
                            )}
                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={loading || modalOpen}
                                    className="relative w-full rounded-xl bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 p-[2px] shadow-lg shadow-sky-900/30 focus:outline-none focus:ring-2 focus:ring-sky-400/50 disabled:opacity-50 disabled:cursor-not-allowed group"
                                >
                                    <span className="block w-full rounded-[10px] bg-slate-950 px-5 py-3 text-sm font-semibold tracking-wide text-slate-100 group-hover:bg-slate-900 transition-colors">
                                        {loading ? 'Signing in...' : 'Sign in'}
                                    </span>
                                </button>
                            </div>
                        </form>
                        {/* <div className="mt-8 text-[10px] text-center text-slate-500 tracking-wider uppercase">
                            Secure Untis credential verification • v1
                        </div> */}
                    </div>
                </div>
            </div>
            <RequestAccessModal
                isOpen={showRequestAccessModal}
                onClose={() => setShowRequestAccessModal(false)}
                username={username}
            />
            <PendingAccessRequestModal
                isOpen={showPendingAccessModal}
                onClose={() => setShowPendingAccessModal(false)}
                username={username}
                requestedAt={pendingRequestedAt}
            />
        </div>
    );
}
