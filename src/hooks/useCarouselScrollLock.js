import { useEffect, useRef, useState } from 'react';

/**
 * While the section is in view, wheel scroll advances carousel slides first.
 * Section snaps to center once on enter; after the last slide, page scroll continues.
 */
export function useCarouselScrollLock(ref, totalSlides, index, setIndex) {
    const [locked, setLocked] = useState(false);
    const [completed, setCompleted] = useState(false);
    const indexRef = useRef(index);
    const wheelCooldown = useRef(false);
    const hasSnapped = useRef(false);

    useEffect(() => {
        indexRef.current = index;
    }, [index]);

    useEffect(() => {
        if (!ref.current) return undefined;
        const el = ref.current;

        const observer = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting) {
                setLocked(false);
                setCompleted(false);
                hasSnapped.current = false;
                return;
            }
            if (entry.intersectionRatio >= 0.45 && !completed) {
                setLocked(true);
                if (!hasSnapped.current) {
                    hasSnapped.current = true;
                    requestAnimationFrame(() => {
                        el.scrollIntoView({ behavior: 'auto', block: 'center' });
                    });
                }
            }
        }, { threshold: [0, 0.35, 0.45, 0.6, 0.75] });

        observer.observe(el);
        return () => observer.disconnect();
    }, [ref, completed]);

    useEffect(() => {
        if (!locked || completed) return undefined;

        const handleWheel = (e) => {
            if (wheelCooldown.current) {
                e.preventDefault();
                return;
            }

            const down = e.deltaY > 0;
            const up = e.deltaY < 0;
            if (!down && !up) return;

            if (down) {
                if (indexRef.current < totalSlides - 1) {
                    e.preventDefault();
                    wheelCooldown.current = true;
                    indexRef.current += 1;
                    setIndex(indexRef.current);
                    setTimeout(() => { wheelCooldown.current = false; }, 450);
                } else {
                    setLocked(false);
                    setCompleted(true);
                }
            } else if (up) {
                if (indexRef.current > 0) {
                    e.preventDefault();
                    wheelCooldown.current = true;
                    indexRef.current -= 1;
                    setIndex(indexRef.current);
                    setTimeout(() => { wheelCooldown.current = false; }, 450);
                } else {
                    setLocked(false);
                }
            }
        };

        window.addEventListener('wheel', handleWheel, { passive: false });
        return () => window.removeEventListener('wheel', handleWheel);
    }, [locked, completed, totalSlides, setIndex]);

    return { locked, completed };
}
