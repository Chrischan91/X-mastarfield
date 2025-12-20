
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AppMode, GestureState } from '../types';

interface GestureInfoPanelProps {
  mode: AppMode;
  gestureState: GestureState;
}

const STORAGE_KEY = 'gesture-guide-pos-v1';

export const GestureInfoPanel: React.FC<GestureInfoPanelProps> = ({ mode, gestureState }) => {
  const [position, setPosition] = useState({ x: -2000, y: -2000 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const latestPos = useRef({ x: 0, y: 0 });

  const clampToViewport = useCallback((x: number, y: number) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Get actual dimensions or fallback to estimated defaults based on Tailwind classes
    const panelW = panelRef.current?.offsetWidth || (w >= 1024 ? 460 : w >= 768 ? 420 : 260);
    const panelH = panelRef.current?.offsetHeight || (w >= 768 ? 120 : 85);
    
    return {
      x: Math.max(10, Math.min(w - panelW - 10, x)),
      y: Math.max(10, Math.min(h - panelH - 10, y))
    };
  }, []);

  const setInitialPosition = useCallback(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    
    // Determine the expected width for centering before the ref is fully rendered/measured
    let expectedW = 260;
    if (w >= 1024) expectedW = 460;
    else if (w >= 768) expectedW = 420;

    // Determine the expected height - reduced for mobile
    const expectedH = w >= 768 ? 120 : 85;

    // Safe bottom spacing - increased for mobile to clear browser UI elements
    const bottomMargin = w < 768 ? 40 : 60;

    const initial = {
      x: (w / 2) - (expectedW / 2),
      y: h - expectedH - bottomMargin
    };
    
    const clamped = clampToViewport(initial.x, initial.y);
    setPosition(clamped);
    latestPos.current = clamped;
  }, [clampToViewport]);

  // Handle Review Mode centering on mobile
  useEffect(() => {
    if (window.innerWidth < 768 && mode === AppMode.FOCUS) {
      // Automatically snap to bottom center when reviewing a photo on mobile
      setInitialPosition();
    }
  }, [mode, setInitialPosition]);

  // Initial load and resize handling
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const clamped = clampToViewport(parsed.x, parsed.y);
        setPosition(clamped);
        latestPos.current = clamped;
      } catch (e) {
        setInitialPosition();
      }
    } else {
      setInitialPosition();
    }

    const handleResize = () => {
      // Only auto-recenter if the user hasn't saved a custom position
      if (!localStorage.getItem(STORAGE_KEY)) {
        setInitialPosition();
      } else {
        // If they have a saved position, still clamp it to ensure it's on screen
        try {
          const savedPos = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
          if (savedPos.x !== undefined) {
            const clamped = clampToViewport(savedPos.x, savedPos.y);
            setPosition(clamped);
            latestPos.current = clamped;
          }
        } catch (e) {
           setInitialPosition();
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampToViewport, setInitialPosition]);

  const onDragStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    dragStartOffset.current = {
      x: clientX - position.x,
      y: clientY - position.y
    };
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

      const newX = clientX - dragStartOffset.current.x;
      const newY = clientY - dragStartOffset.current.y;

      const clamped = clampToViewport(newX, newY);
      setPosition(clamped);
      latestPos.current = clamped;

      if ('touches' in e && e.cancelable) e.preventDefault();
    };

    const handleEnd = () => {
      if (isDragging) {
        setIsDragging(false);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(latestPos.current));
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend', handleEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, clampToViewport]);

  return (
    <div 
      ref={panelRef}
      style={{ 
        left: `${position.x}px`, 
        top: `${position.y}px`,
        visibility: position.x === -2000 ? 'hidden' : 'visible'
      }}
      className={`fixed z-[40] pointer-events-auto transition-opacity duration-300 select-none shadow-[0_10px_30px_rgba(0,0,0,0.8)] rounded-lg group ${isDragging ? 'opacity-90 scale-[1.01]' : 'opacity-100'}`}
    >
      <div className="bg-black/70 backdrop-blur-2xl border border-[#FFD700]/30 rounded-lg p-1.5 md:p-3.5 min-w-[260px] md:min-w-[420px] lg:min-w-[460px]">
        {/* Drag Handle - Compact */}
        <div 
          onMouseDown={(e) => onDragStart(e.clientX, e.clientY)}
          onTouchStart={(e) => onDragStart(e.touches[0].clientX, e.touches[0].clientY)}
          className="flex items-center justify-between mb-1 md:mb-2 cursor-grab active:cursor-grabbing hover:bg-white/5 p-1 rounded transition-colors"
        >
          <div className="flex items-center gap-1.5 md:gap-2">
             <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFD700" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-50 md:w-3 md:h-3">
                <circle cx="9" cy="9" r="1"/><circle cx="15" cy="9" r="1"/><circle cx="9" cy="15" r="1"/><circle cx="15" cy="15" r="1"/>
             </svg>
             <h3 className="text-[#FFD700] font-cinzel text-[8px] md:text-[10px] tracking-[0.2em] font-bold uppercase drop-shadow-[0_0_5px_rgba(255,215,0,0.2)]">Gesture Guide</h3>
          </div>
          <span className="font-mono text-[5px] md:text-[7px] text-[#FFD700]/20 uppercase tracking-widest">Moveable</span>
        </div>

        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#FFD700]/30 to-transparent mb-1.5 md:mb-2.5"></div>

        {/* Compact grid with labels */}
        <div className="grid grid-cols-2 gap-x-3 md:gap-x-8 gap-y-0.3 md:gap-y-0.5">
           <div className={`flex items-center gap-1.5 md:gap-4 transition-all duration-500 ${mode === AppMode.TREE ? 'brightness-125' : 'opacity-50'}`}>
              <span className="text-sm md:text-2xl drop-shadow-[0_0_6px_rgba(255,215,0,0.3)]">✊</span>
              <span className="font-playfair text-[#FFD700] text-[8px] md:text-[11px] tracking-tight whitespace-nowrap">Fist: Tree Assembled</span>
           </div>
           <div className={`flex items-center gap-1.5 md:gap-4 transition-all duration-500 ${mode === AppMode.SCATTER ? 'brightness-125' : 'opacity-50'}`}>
              <span className="text-sm md:text-2xl drop-shadow-[0_0_6px_rgba(255,215,0,0.3)]">✋</span>
              <span className="font-playfair text-[#FFD700] text-[8px] md:text-[11px] tracking-tight whitespace-nowrap">Open: Tree Exploded</span>
           </div>
           <div className={`flex items-center gap-1.5 md:gap-4 transition-all duration-500 ${mode === AppMode.FOCUS ? 'brightness-125' : 'opacity-50'}`}>
              <span className="text-sm md:text-2xl drop-shadow-[0_0_6px_rgba(255,215,0,0.3)]">🤏</span>
              <span className="font-playfair text-[#FFD700] text-[8px] md:text-[11px] tracking-tight whitespace-nowrap">Pinch: Picture Focused</span>
           </div>
           <div className={`flex items-center gap-1.5 md:gap-4 transition-all duration-500 ${mode === AppMode.NEW_YEAR ? 'brightness-125' : 'opacity-50'}`}>
              <span className="text-sm md:text-2xl drop-shadow-[0_0_6px_rgba(255,215,0,0.3)]">✌</span>
              <span className="font-playfair text-[#FFD700] text-[8px] md:text-[11px] tracking-tight whitespace-nowrap">Yeah: Merry Christmas</span>
           </div>
        </div>
        
        {/* Footer */}
        <div className="mt-1.5 md:mt-3 pt-1.5 md:pt-2 border-t border-[#FFD700]/10 flex justify-between items-center">
           <span className="font-mono text-[6px] md:text-[8px] text-[#FFD700]/40 uppercase tracking-widest truncate max-w-[80px] md:max-w-[100px]">MOD: {gestureState.gesture}</span>
           <div className="flex items-center gap-1">
              <span className="text-[5px] md:text-[7px] font-cinzel text-[#FFD700]/20 tracking-[0.1em]">{gestureState.isDetected ? 'LINKED' : 'WAITING'}</span>
              <div className={`w-1 h-1 md:w-2 md:h-2 rounded-full ${gestureState.isDetected ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-red-500/30'}`}></div>
           </div>
        </div>
      </div>
    </div>
  );
};
