import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT = 960;
const DESKTOP_BREAKPOINT = 1280;

function getViewportWidth() {
  if (typeof window === 'undefined') return DESKTOP_BREAKPOINT;
  return window.innerWidth;
}

export function useViewport() {
  const [width, setWidth] = useState(getViewportWidth);

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    width,
    isMobile: width < MOBILE_BREAKPOINT,
    isTablet: width >= MOBILE_BREAKPOINT && width < DESKTOP_BREAKPOINT,
    isDesktop: width >= DESKTOP_BREAKPOINT,
  };
}
