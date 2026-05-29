import React, { useRef } from 'react';
import { useScrollPinnedSlides, NAVBAR_OFFSET } from '../hooks/useScrollPinnedSlides';
import './PinnedCarouselSection.css';

/**
 * Tall scroll track + sticky inner panel so carousel cards stay in the same
 * on-screen position while the user scrolls through every slide.
 */
export default function PinnedCarouselSection({
    id,
    totalSlides,
    index,
    setIndex,
    className = '',
    stickyClassName = '',
    outerStyle = {},
    children,
}) {
    const pinRef = useRef(null);
    const slides = Math.max(totalSlides, 1);

    useScrollPinnedSlides(pinRef, slides, setIndex);

    return (
        <div
            id={id}
            ref={pinRef}
            className={`carousel-scroll-pin ${className}`.trim()}
            style={{ height: `${slides * 100}vh`, ...outerStyle }}
            aria-label="Scroll through slides"
        >
            <div
                className={`carousel-scroll-pin__sticky ${stickyClassName}`.trim()}
                style={{ top: NAVBAR_OFFSET, minHeight: `calc(100vh - ${NAVBAR_OFFSET}px)` }}
            >
                {children}
            </div>
        </div>
    );
}
