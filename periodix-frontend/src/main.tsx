import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

// Mount a custom scrollbar track attached to #app-scroll
function mountCustomScrollbar() {
    const container = document.getElementById(
        'app-scroll'
    ) as HTMLElement | null;
    if (!container) return;
    // Avoid duplicates
    if (document.body.querySelector('.custom-scrollbar')) return;

    const track = document.createElement('div');
    track.className = 'custom-scrollbar';
    const thumb = document.createElement('div');
    thumb.className = 'custom-scrollbar-thumb';
    track.appendChild(thumb);
    // Append to body so it is never affected by transformed ancestors
    document.body.appendChild(track);

    const update = () => {
        const { scrollTop, scrollHeight, clientHeight } = container;
        const ratio = clientHeight / scrollHeight;
        const thumbHeight = Math.max(32, Math.floor(clientHeight * ratio));

        // Get viewport bounds and track bounds
        const viewportHeight = window.innerHeight;
        const trackTop = 10;
        const trackBottom = 10;
        const availableHeight = viewportHeight - trackTop - trackBottom;

        // Ensure thumb doesn't exceed available space
        const constrainedThumbHeight = Math.min(
            thumbHeight,
            availableHeight - 4
        );
        const maxTop = availableHeight - constrainedThumbHeight;

        const top =
            scrollHeight > clientHeight
                ? Math.max(
                      0,
                      Math.min(
                          maxTop,
                          Math.floor(
                              (scrollTop / (scrollHeight - clientHeight)) *
                                  maxTop
                          )
                      )
                  )
                : 0;

        thumb.style.height = `${constrainedThumbHeight}px`;
        thumb.style.transform = `translateY(${top}px)`;
        track.classList.toggle('hidden', scrollHeight <= clientHeight);
    };

    let isDragging = false;
    let dragStartY = 0;
    let startScrollTop = 0;
    const onPointerDown = (e: PointerEvent) => {
        isDragging = true;
        dragStartY = e.clientY;
        startScrollTop = container.scrollTop;
        thumb.setPointerCapture(e.pointerId);
        document.body.classList.add('select-none');
    };
    const onPointerMove = (e: PointerEvent) => {
        if (!isDragging) return;
        const { scrollHeight, clientHeight } = container;
        const ratio = clientHeight / scrollHeight;

        // Get viewport bounds
        const viewportHeight = window.innerHeight;
        const trackTop = 10;
        const trackBottom = 10;
        const availableHeight = viewportHeight - trackTop - trackBottom;

        const thumbHeight = Math.max(32, Math.floor(clientHeight * ratio));
        const constrainedThumbHeight = Math.min(
            thumbHeight,
            availableHeight - 4
        );
        const maxTop = availableHeight - constrainedThumbHeight;

        const delta = e.clientY - dragStartY;
        const scrollable = scrollHeight - clientHeight;
        const scrollDelta = (delta / maxTop) * scrollable;
        container.scrollTop = Math.max(
            0,
            Math.min(scrollable, startScrollTop + scrollDelta)
        );
    };
    const endDrag = (e?: PointerEvent) => {
        isDragging = false;
        if (e) thumb.releasePointerCapture(e.pointerId);
        document.body.classList.remove('select-none');
    };
    thumb.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('resize', update);
    container.addEventListener('scroll', update, { passive: true });
    // Track click: jump to position
    track.addEventListener('pointerdown', (e) => {
        if (e.target === thumb) return;
        const rect = track.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const { scrollHeight, clientHeight } = container;
        const ratio = clientHeight / scrollHeight;

        // Get viewport bounds
        const viewportHeight = window.innerHeight;
        const trackTop = 10;
        const trackBottom = 10;
        const availableHeight = viewportHeight - trackTop - trackBottom;

        const thumbHeight = Math.max(32, Math.floor(clientHeight * ratio));
        const constrainedThumbHeight = Math.min(
            thumbHeight,
            availableHeight - 4
        );
        const maxTop = availableHeight - constrainedThumbHeight;

        const targetTop = Math.max(
            0,
            Math.min(maxTop, y - constrainedThumbHeight / 2)
        );
        const scrollable = scrollHeight - clientHeight;
        container.scrollTop = Math.max(
            0,
            Math.min(scrollable, (targetTop / maxTop) * scrollable)
        );
    });
    update();
}

// Defer custom scrollbar setup until after initial render
requestAnimationFrame(() => {
    mountCustomScrollbar();
});

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>
);

// Register service worker after initial render (deferred)
if ('serviceWorker' in navigator) {
    // Use requestIdleCallback if available, otherwise setTimeout
    const registerSW = () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {
            // Silently ignore registration errors
        });
    };
    
    if ('requestIdleCallback' in window) {
        (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(registerSW);
    } else {
        setTimeout(registerSW, 1000);
    }
}
