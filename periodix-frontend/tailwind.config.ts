import type { Config } from 'tailwindcss';

export default {
    darkMode: 'class',
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    safelist: [
        'ring-4',
        'ring-rose-500',
        'ring-rose-400',
        'ring-emerald-500',
        'ring-emerald-400',
        'border-4',
        'border-6',
        'border-8',
        'border-rose-500',
        'border-rose-400',
        'border-emerald-500',
        'border-emerald-400',
    ],
    theme: {
        extend: {
            screens: {
                xs: '480px',
            },
        },
    },
    plugins: [],
} satisfies Config;
