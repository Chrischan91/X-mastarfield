
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AppMode, GestureState } from '../types';

interface GestureInfoPanelProps {
  mode: AppMode;
  gestureState: GestureState;
  onManualModeChange?: (newMode: AppMode) => void;
  isWebcamOff?: boolean;
  isVisible?: boolean;
}

const STORAGE_KEY = 'gesture-guide-pos-v1';

export const GestureInfoPanel: React.FC<GestureInfoPanelProps> = ({ 
  mode, 
  gestureState, 
  onManualModeChange, 
  isWebcamOff,
  isVisible = true
}) => {
  const [position, setPosition] = useState({ x: -2000, y: -2000 });
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const dragStartOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const latestPos = useRef({ x: 0, y: 0 });

  const clampToViewport = useCallback((x: number, y: number) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const panelW = panelRef.current?.offsetWidth || (w >= 1024 ? 350 : w >= 768 ? 320 : 220);
    const panelH = panelRef.current?.offsetHeight || (w >= 768 ? 100 : 75);
    
    return {
      x: Math.max(10, Math.min(w - panelW - 10, x)),
      y: Math.max(10, Math.min(h - panelH - 10, y))
    };
  }, []);

  const setInitialPosition = useCallback(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const isMob = w < 768;
    setIsMobile(isMob);

    if (isMob) {
      // Fixed at bottom center for mobile
      return;
    }
    
    let expectedW = w >= 1024 ? 350 : 320;
    const expectedH = 100;
    const bottomMargin = 40;

    const initial = {
      x: (w / 2) - (expectedW / 2),
      y: h - expectedH - bottomMargin
    };
    
    const clamped = clampToViewport(initial.x, initial.y);
    setPosition(clamped);
    latestPos.current = clamped;
  }, [clampToViewport]);

  useEffect(() => {
    setInitialPosition();
    const handleResize = () => {
      setInitialPosition();
      if (window.innerWidth >= 768) {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            const clamped = clampToViewport(parsed.x, parsed.y);
            setPosition(clamped);
            latestPos.current = clamped;
          } catch (e) {}
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampToViewport, setInitialPosition]);

  const onDragStart = (clientX: number, clientY: number) => {
    if (isMobile || !isVisible) return; 
    setIsDragging(true);
    dragStartOffset.current = {
      x: clientX - position.x,
      y: clientY - position.y
    };
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging || isMobile) return;
      
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
  }, [isDragging, clampToViewport, isMobile]);

  const handleModeItemClick = (targetMode: AppMode) => {
      // Allowed manual mode change even when webcam is on
      if (onManualModeChange && isVisible) {
          onManualModeChange(targetMode);
      }
  };

  // Always enable cursor pointer and hover effects for interactivity
  const clickableClass = 'cursor-pointer hover:bg-white/10 active:scale-95';

  const mobileContainerStyle: React.CSSProperties = isMobile ? {
    left: '50%',
    bottom: '16px',
    transform: 'translateX(-50%)',
    width: 'calc(100% - 60px)',
    maxWidth: '260px'
  } : {
    left: `${position.x}px`, 
    top: `${position.y}px`,
    visibility: (position.x === -2000 ? 'hidden' : 'visible') as 'hidden' | 'visible'
  };

  return (
    <div 
      ref={panelRef}
      style={mobileContainerStyle}
      className={`fixed z-[48] transition-all duration-700 select-none shadow-[0_10px_30px_rgba(0,0,0,0.8)] rounded-sm group ${isDragging ? 'opacity-90 scale-[1.01]' : ''} ${isMobile ? 'scale-100' : ''} ${isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
    >
      <div className={`bg-black/85 backdrop-blur-3xl border border-[#FFD700]/30 rounded-sm p-2 md:p-2.5 ${!isMobile ? 'min-w-[320px] lg:min-w-[350px]' : ''}`}>
        {/* Header - Compact */}
        <div 
          onMouseDown={(e) => onDragStart(e.clientX, e.clientY)}
          onTouchStart={(e) => onDragStart(e.touches[0].clientX, e.touches[0].clientY)}
          className={`flex items-center justify-between mb-1.5 ${isMobile ? 'cursor-default' : 'cursor-grab active:cursor-grabbing hover:bg-white/5'} px-1 py-0.5 rounded transition-colors`}
        >
          <div className="flex items-center gap-1.5">
             <div className="w-1 h-1 rounded-full bg-[#FFD700] shadow-[0_0_6px_#FFD700]"></div>
             <h3 className="text-[#FFD700] font-cinzel text-[8px] md:text-[9px] tracking-[0.2em] font-bold uppercase">GESTURE GUIDE</h3>
          </div>
          <span className="font-mono text-[6px] text-[#FFD700]/30 uppercase tracking-[0.1em]">
              {isWebcamOff ? 'MANUAL' : 'HYBRID'}
          </span>
        </div>

        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#FFD700]/20 to-transparent mb-2"></div>

        {/* Mode Grid - Scaled Down */}
        <div className={`grid ${isMobile ? 'grid-cols-2 gap-1.5' : 'grid-cols-2 gap-x-4 gap-y-1'}`}>
           {[
             { mode: AppMode.TREE, icon: '✊', label: 'Fist: Assemble' },
             { mode: AppMode.SCATTER, icon: '✋', label: 'Palm: Explode' },
             { mode: AppMode.FOCUS, icon: '🤏', label: 'Pinch: Memory' },
             { mode: AppMode.NEW_YEAR, icon: '✌', label: 'Yeah: Message' }
           ].map((item) => (
             <div 
                key={item.mode}
                onClick={() => handleModeItemClick(item.mode)}
                className={`flex items-center gap-2 transition-all duration-300 p-1 md:p-1.5 rounded-sm border ${mode === item.mode ? 'bg-[#FFD700]/15 border-[#FFD700]/40 brightness-110' : 'bg-white/5 border-transparent opacity-50'} ${clickableClass}`}
             >
                <span className={`${isMobile ? 'text-sm' : 'text-lg'} drop-shadow-[0_0_5px_rgba(255,215,0,0.3)]`}>{item.icon}</span>
                <span className={`font-cinzel text-[#FFD700] ${isMobile ? 'text-[8px]' : 'text-[9px]'} tracking-wider whitespace-nowrap uppercase font-bold`}>{item.label}</span>
             </div>
           ))}
        </div>
        
        {/* Status Bar - Minimal */}
        <div className="mt-2 pt-1.5 border-t border-[#FFD700]/10 flex justify-between items-center">
           <div className="flex items-center gap-1.5">
              <span className="font-mono text-[7px] text-[#FFD700]/40 uppercase tracking-widest">STATE:</span>
              <span className="font-mono text-[7px] text-white/90 uppercase tracking-widest bg-[#FFD700]/5 px-1.5 rounded-full border border-[#FFD700]/10">
                {isWebcamOff ? 'USER' : (gestureState.gesture === 'NONE' ? 'SEARCH' : gestureState.gesture)}
              </span>
           </div>
           <div className={`w-1 h-1 rounded-full ${!isWebcamOff && gestureState.isDetected ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : (isWebcamOff ? 'bg-[#FFD700]/20' : 'bg-red-500/20 animate-pulse')}`}></div>
        </div>
      </div>
    </div>
  );
};
