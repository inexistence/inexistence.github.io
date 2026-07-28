import { useEffect, useRef, useState } from 'react';
import { Loading } from 'animal-island-ui/es/components/Loading/Loading.js';

const revealDuration = (element: HTMLElement) => {
  const { width, height } = element.getBoundingClientRect();
  const radius = Math.ceil(Math.hypot(width, height) / 2) + 50;
  return Math.max(100, (radius / 1500) * 1000);
};

export function ExhibitionLoading() {
  const hostRef = useRef<HTMLDivElement>(null);
  const revealedRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);
  const [active, setActive] = useState(true);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const reveal = () => {
      if (revealedRef.current) return;
      revealedRef.current = true;
      setActive(false);

      // The library calculates this same radius from the Loading container
      // before expanding its circular mask. Two frames let its effect commit
      // before this controller reports that the reveal is complete.
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          timerRef.current = window.setTimeout(() => {
            host.dispatchEvent(new CustomEvent('exhibition-loading:revealed', { bubbles: true }));
          }, revealDuration(host) + 40);
        });
      });
    };

    host.addEventListener('exhibition-loading:reveal', reveal);
    host.dispatchEvent(new CustomEvent('exhibition-loading:mounted', { bubbles: true }));
    if (host.dataset.revealRequested === 'true') reveal();

    return () => {
      host.removeEventListener('exhibition-loading:reveal', reveal);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div ref={hostRef} className="exhibition-tour__loading-island">
      <Loading active={active} />
    </div>
  );
}
