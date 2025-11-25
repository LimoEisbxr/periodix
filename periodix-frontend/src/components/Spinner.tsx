interface SpinnerProps {
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

export default function Spinner({ className = '', size = 'md' }: SpinnerProps) {
    const sizeClasses = {
        sm: 'h-4 w-4',
        md: 'h-6 w-6',
        lg: 'h-8 w-8',
    };

    return (
        <svg
            viewBox="0 0 24 24"
            className={`animate-spin ${sizeClasses[size]} ${className}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            role="status"
            aria-label="Loading"
        >
            <circle cx="12" cy="12" r="9" className="opacity-25" />
            <path d="M21 12a9 9 0 0 0-9-9" className="opacity-75" />
        </svg>
    );
}
