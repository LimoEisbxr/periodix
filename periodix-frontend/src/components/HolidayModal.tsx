import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Holiday } from '../types';

export default function HolidayModal({
    holiday,
    isOpen,
    onClose,
}: {
    holiday: Holiday | null;
    isOpen: boolean;
    onClose: () => void;
}) {
    const [animatingOut, setAnimatingOut] = useState(false);
    const [entered, setEntered] = useState(false);

    const lockScroll = () => {
        document.documentElement.classList.add('modal-open');
    };
    const unlockScroll = () => {
        document.documentElement.classList.remove('modal-open');
    };

    const shouldRender = isOpen || animatingOut;

    useEffect(() => {
        let raf1: number | null = null;
        let raf2: number | null = null;
        if (isOpen) {
            if (animatingOut) return;
            
            setEntered(false);
            lockScroll();
            raf1 = requestAnimationFrame(() => {
                raf2 = requestAnimationFrame(() => setEntered(true));
            });
        } else {
            if (animatingOut) {
                setAnimatingOut(false);
            }
            unlockScroll();
        }
        return () => {
            if (raf1) cancelAnimationFrame(raf1);
            if (raf2) cancelAnimationFrame(raf2);
        };
    }, [isOpen, animatingOut]);

    const handleClose = useCallback(() => {
        setEntered(false);
        setAnimatingOut(true);
        setTimeout(() => {
            unlockScroll();
            onClose();
        }, 200);
    }, [onClose]);

    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') handleClose();
        };
        if (shouldRender) document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [shouldRender, handleClose]);

    if (!shouldRender || !holiday) return null;

    // Format dates
    const parseUntisDate = (n: number) => {
        const s = String(n);
        const y = Number(s.slice(0, 4));
        const mo = Number(s.slice(4, 6));
        const d = Number(s.slice(6, 8));
        return new Date(y, mo - 1, d);
    };

    const startDate = parseUntisDate(holiday.startDate);
    const endDate = parseUntisDate(holiday.endDate);

    const formatDate = (d: Date) => {
        return d.toLocaleDateString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const isSingleDay = holiday.startDate === holiday.endDate;

    return createPortal(
        <div
            className={`fixed inset-0 z-[9999] modal-portal flex items-center justify-center p-4 bg-black/50 backdrop-blur-lg backdrop-saturate-150 backdrop-contrast-125 transition-opacity duration-200 ease-out ${
                entered ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={handleClose}
        >
            <div
                className={`relative w-full max-w-md overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/10 dark:ring-white/10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md transition-all duration-200 ease-out will-change-transform will-change-opacity ${
                    entered
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-2'
                }`}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                <div className="relative p-6 text-center">
                    {/* Decorative background icon */}
                    <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-yellow-100/50 to-transparent dark:from-yellow-900/20 pointer-events-none" />

                    <div className="relative z-10 flex flex-col items-center">
                        <div className="w-16 h-16 mb-4 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center ring-4 ring-white dark:ring-slate-800 shadow-lg">
                            <svg
                                className="w-8 h-8 text-yellow-600 dark:text-yellow-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                                />
                            </svg>
                        </div>

                        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2 leading-tight">
                            {holiday.longName}
                        </h2>

                        {holiday.name !== holiday.longName && (
                            <p className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-6">
                                {holiday.name}
                            </p>
                        )}

                        <div className="w-full bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700/50">
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500 dark:text-slate-400">
                                        Start
                                    </span>
                                    <span className="font-medium text-slate-900 dark:text-slate-200">
                                        {formatDate(startDate)}
                                    </span>
                                </div>
                                {!isSingleDay && (
                                    <>
                                        <div className="h-px bg-slate-200 dark:bg-slate-700/50 w-full" />
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-slate-500 dark:text-slate-400">
                                                End
                                            </span>
                                            <span className="font-medium text-slate-900 dark:text-slate-200">
                                                {formatDate(endDate)}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleClose}
                        className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
