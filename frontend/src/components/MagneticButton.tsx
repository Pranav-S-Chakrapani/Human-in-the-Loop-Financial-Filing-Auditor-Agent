import React, { useRef, useState, useEffect } from 'react';

interface MagneticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  maxShift?: number; // max interaction shift in px toward cursor (default 8px)
  radius?: number; // legacy alias compatibility
}

export const MagneticButton: React.FC<MagneticButtonProps> = ({
  children,
  className = '',
  maxShift = 8,
  radius,
  onClick,
  ...props
}) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (prefersReducedMotion || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const deltaX = e.clientX - centerX;
    const deltaY = e.clientY - centerY;

    // Normalize within bounding box half-extents
    const normX = Math.max(-1, Math.min(1, deltaX / (rect.width / 2)));
    const normY = Math.max(-1, Math.min(1, deltaY / (rect.height / 2)));

    // Shift up to maxShift (8px) toward cursor with spring ease
    setPosition({ x: normX * maxShift, y: normY * maxShift });
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setIsPressed(false);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = () => {
    setIsPressed(true);
  };

  const handleMouseUp = () => {
    setIsPressed(false);
  };

  return (
    <button
      ref={btnRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={onClick}
      style={{
        transform: prefersReducedMotion
          ? isPressed ? 'scale(0.97)' : 'none'
          : `translate3d(${position.x}px, ${position.y + (isPressed ? 1.5 : 0)}px, 0) scale(${isPressed ? 0.97 : 1})`,
        transition: isPressed
          ? 'transform 0.06s ease-out'
          : isHovered
          ? 'transform 0.12s cubic-bezier(0.25, 1, 0.5, 1)'
          : 'transform 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275)', // spring-like settle
      }}
      className={`relative select-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal,#E8B339)] ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
