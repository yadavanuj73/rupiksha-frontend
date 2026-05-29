import { useEffect } from 'react';

const NAVBAR_OFFSET = 92;

/**
 * Maps vertical scroll progress through a tall pin wrapper to slide index.
 * The sticky inner panel stays fixed; only the slide index changes.
 */
export function useScrollPinnedSlides(pinRef, totalSlides, setIndex) {
    useEffect(() => {
        if (!pinRef.current || totalSlides < 1) return undefined;

        const update = () => {
            const el = pinRef.current;
            if (!el) return;

            const stickyH = window.innerHeight - NAVBAR_OFFSET;
            const scrollable = Math.max(el.offsetHeight - stickyH, 1);
            const scrolled = Math.min(Math.max(NAVBAR_OFFSET - el.getBoundingClientRect().top, 0), scrollable);
            const progress = scrolled / scrollable;
            const idx = Math.min(totalSlides - 1, Math.floor(progress * totalSlides));
            setIndex(idx);
        };

        update();
        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update, { passive: true });
        return () => {
            window.removeEventListener('scroll', update);
            window.removeEventListener('resize', update);
        };
    }, [pinRef, totalSlides, setIndex]);
}

export { NAVBAR_OFFSET };
