
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Experience } from './components/Experience';
import { GestureControl } from './components/GestureControl';
import { GestureInfoPanel } from './components/GestureInfoPanel';
import { AppMode, GestureState, UploadedImage } from './types';
const MemoExperience = React.memo(Experience);

const BACKGROUND_MUSIC_SRC = "https://www.dropbox.com/scl/fi/x9um45qqfb00dbf70vttr/Pastlives.mp3?rlkey=55utc8ph38imksvxqqn9vrdtx&st=qivvio3u&raw=1";

interface Track {
  id: string;
  name: string;
  url: string;
}

const App: React.FC = () => {
  const nameRef = useRef("");
  const inputElRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<AppMode>(AppMode.TREE);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [gestureState, setGestureState] = useState<GestureState>({ x: 0, y: 0, handSize: 0, isDetected: false, gesture: 'NONE' });
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [webcamEnabled, setWebcamEnabled] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isPanelExpanded, setIsPanelExpanded] = useState(true);
  
  // Dragging state for the Memorialize dialog
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogPos, setDialogPos] = useState({ x: 0, y: 0 });
  const [isDraggingDialog, setIsDraggingDialog] = useState(false);
  const dialogDragOffset = useRef({ x: 0, y: 0 });
  const dialogRef = useRef<HTMLDivElement>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Playlist State
  const [playlist, setPlaylist] = useState<Track[]>([
    { id: 'default', name: "Pastlives (Dropbox)", url: BACKGROUND_MUSIC_SRC }
  ]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);

  // iOS Viewport fix: Blur and Reset scroll
  const resetViewport = useCallback(() => {
    if (inputElRef.current) {
      inputElRef.current.blur();
    }
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setTimeout(() => {
      window.scrollTo(0, 0);
      document.body.scrollTop = 0;
    }, 50);
  }, []);

  useEffect(() => {
    if (editingId) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      window.scrollTo(0, 0);
    }
  }, [editingId]);

  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      if (mode === AppMode.NEW_YEAR) {
        setIsPanelExpanded(false);
      } else {
        setIsPanelExpanded(true);
      }
    }
  }, [mode]);

  useEffect(() => {
    const audio = new Audio(playlist[currentTrackIndex].url);
    audio.loop = false;
    audio.volume = 0.4;
    audio.preload = "auto";
    audio.onplay = () => setIsPlaying(true);
    audio.onpause = () => setIsPlaying(false);
    
    audio.onended = () => {
      handleNextTrack();
    };

    audioRef.current = audio;

    return () => {
        if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
        audio.pause();
        audio.src = "";
        audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (audioRef.current && hasStarted) {
      const wasPlaying = !audioRef.current.paused;
      audioRef.current.src = playlist[currentTrackIndex].url;
      if (wasPlaying || hasStarted) {
        audioRef.current.play().catch(console.error);
      }
    }
  }, [currentTrackIndex, playlist]);

  const handleNextTrack = useCallback(() => {
    setCurrentTrackIndex((prev) => (prev + 1) % playlist.length);
  }, [playlist.length]);

  const handlePrevTrack = useCallback(() => {
    setCurrentTrackIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
  }, [playlist.length]);

  const startExperience = () => {
    setHasStarted(true);
    if (audioRef.current) {
      audioRef.current.play().catch(error => {
        console.warn("Audio play failed:", error);
      });
    }
  };

  useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;
      const isInteracting = !!editingId || (mode === AppMode.FOCUS && !!focusId);
      const targetVolume = isInteracting ? 0.1 : 0.4;
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = window.setInterval(() => {
          if (!audio) return;
          const current = audio.volume;
          const diff = targetVolume - current;
          if (Math.abs(diff) < 0.01) {
              audio.volume = targetVolume;
              if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
          } else {
              audio.volume += diff * 0.1;
          }
      }, 50);
      return () => {
          if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
      };
  }, [editingId, mode, focusId]);
  
  const handleMusicUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
        const newTracks: Track[] = Array.from(event.target.files).map((file: File) => ({
            id: uuidv4(),
            name: file.name,
            url: URL.createObjectURL(file)
        }));
        
        setPlaylist(prev => [...prev, ...newTracks]);
        event.target.value = '';
    }
  };

  const toggleMusic = () => {
      if (!audioRef.current) return;
      if (isPlaying) {
          audioRef.current.pause();
      } else {
          audioRef.current.play();
      }
  };

  const lastGestureSwitchRef = useRef<number>(0);

  const handleGestureUpdate = useCallback((state: GestureState) => {
    if (editingId) return;
    setGestureState(state);
    const now = Date.now();
    if (now - lastGestureSwitchRef.current < 1000) return;

    if (state.gesture === 'FIST') {
      if (mode !== AppMode.TREE) {
        setMode(AppMode.TREE);
        setFocusId(null);
        lastGestureSwitchRef.current = now;
      }
    } else if (state.gesture === 'OPEN_PALM') {
      if (mode !== AppMode.SCATTER) {
        setMode(AppMode.SCATTER);
        setFocusId(null);
        lastGestureSwitchRef.current = now;
      }
    } else if (state.gesture === 'PINCH') {
       if (images.length > 0) {
           if (mode !== AppMode.FOCUS) {
               const randomIdx = Math.floor(Math.random() * images.length);
               setFocusId(images[randomIdx].id);
               setMode(AppMode.FOCUS);
               lastGestureSwitchRef.current = now;
           }
       }
    } else if (state.gesture === 'YEAH') {
        if (mode !== AppMode.NEW_YEAR) {
            setMode(AppMode.NEW_YEAR);
            setFocusId(null);
            lastGestureSwitchRef.current = now;
        }
    }
  }, [editingId, images, mode]);

  const generateTreePosition = (): [number, number, number] => {
    const height = 14; 
    const maxRadius = 5.5;
    const y = Math.random() * height;
    const normY = y / height;
    const currentRadius = maxRadius * (1 - normY);
    const angle = Math.random() * Math.PI * 2;
    const r = currentRadius * (0.6 + Math.random() * 0.35); 
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const finalY = y - height / 2; 
    return [x, finalY, z];
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      const url = URL.createObjectURL(file);
      const newId = uuidv4();
      const newImage: UploadedImage = {
        id: newId,
        url,
        position: generateTreePosition(),
        name: ''
      };
      setImages(prev => [...prev, newImage]);
      
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dialogW = w < 768 ? 250 : 280;
      const dialogH = w < 768 ? 140 : 160;
      setDialogPos({
        x: (w / 2) - (dialogW / 2),
        y: h - dialogH - (w < 768 ? 60 : 120)
      });
      
      setEditingId(newId);
      nameRef.current = "";
      setMode(AppMode.TREE);
      setFocusId(null);
      event.target.value = '';
    }
  };

  const handleNameSubmit = () => {
    if (!editingId) return;
    const finalName = nameRef.current.trim();
    setImages(prev =>
      prev.map(img =>
        img.id === editingId ? { ...img, name: finalName } : img
      )
    );
    setEditingId(null);
    nameRef.current = "";
    resetViewport();
  };

  const handleCloseDialog = () => {
    if (!editingId) return;
    setImages(prev => prev.filter(img => img.id !== editingId));
    setEditingId(null);
    nameRef.current = "";
    resetViewport();
  };

  const onDialogDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDraggingDialog(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    dialogDragOffset.current = {
      x: clientX - dialogPos.x,
      y: clientY - dialogPos.y
    };
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDraggingDialog) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

      let newX = clientX - dialogDragOffset.current.x;
      let newY = clientY - dialogDragOffset.current.y;

      const w = window.innerWidth;
      const h = window.innerHeight;
      const dw = dialogRef.current?.offsetWidth || 250;
      const dh = dialogRef.current?.offsetHeight || 140;

      newX = Math.max(10, Math.min(w - dw - 10, newX));
      newY = Math.max(10, Math.min(h - dh - 10, newY));

      setDialogPos({ x: newX, y: newY });
      if ('touches' in e) e.preventDefault();
    };

    const handleEnd = () => setIsDraggingDialog(false);

    if (isDraggingDialog) {
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
  }, [isDraggingDialog, dialogPos]);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      
      {!hasStarted && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black">
          <div className="absolute inset-0 bg-[#050f0a] opacity-60"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,215,0,0.1)_0%,transparent_70%)]"></div>
          <div className="relative z-10 flex flex-col items-center gap-8 md:gap-12 p-8 max-w-lg text-center">
            <div className="flex flex-col items-center">
               <h1 className="font-cinzel text-4xl md:text-7xl text-transparent bg-clip-text bg-gradient-to-b from-[#FFD700] to-[#B8860B] tracking-[0.1em] leading-tight drop-shadow-[0_0_15px_rgba(255,215,0,0.5)] animate-pulse">
                  X'mastarfield
               </h1>
               <div className="h-[2px] w-32 md:w-64 bg-gradient-to-r from-transparent via-[#FFD700] to-transparent mt-6 shadow-[0_0_10px_#FFD700]"></div>
            </div>
            <button 
              onClick={startExperience}
              className="group relative flex items-center justify-center px-12 py-5 md:px-20 md:py-8 border border-[#FFD700]/40 bg-black/40 hover:bg-[#FFD700]/10 transition-all duration-500 rounded-sm overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#FFD700]/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              <span className="font-cinzel text-[#FFD700] text-xl md:text-2xl tracking-[0.5em] font-bold group-hover:scale-110 transition-transform duration-500">
                ENTER
              </span>
            </button>
            <p className="font-playfair text-[#FFD700]/40 text-[10px] md:text-xs tracking-widest italic max-w-[280px] leading-loose">
              Best experienced with audio enabled and camera permissions for gesture control.
            </p>
          </div>
        </div>
      )}

      <div className={`absolute inset-0 z-0 transition-opacity duration-1000 ${hasStarted ? 'opacity-100' : 'opacity-0'}`}>
        <MemoExperience 
          mode={mode} 
          gestureState={gestureState} 
          images={images} 
          editingId={editingId}
          focusId={focusId}
          hasInput={false}
        />
      </div>

      {editingId && (
        <div 
          ref={dialogRef}
          style={{ left: dialogPos.x, top: dialogPos.y }}
          className={`fixed z-50 pointer-events-auto bg-black/70 backdrop-blur-2xl border border-[#FFD700]/80 p-3 md:p-5 rounded-sm shadow-[0_0_40px_rgba(255,215,0,0.15)] flex flex-col gap-3 md:gap-4 w-[85vw] max-w-[250px] md:max-w-[300px] transform transition-transform duration-300 ${isDraggingDialog ? 'scale-[1.01] opacity-90' : 'scale-100 opacity-100'}`}
        >
          <div 
            onMouseDown={onDialogDragStart}
            onTouchStart={onDialogDragStart}
            className="absolute top-0 left-0 w-full h-8 cursor-grab active:cursor-grabbing z-10"
          ></div>
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#FFD700] to-transparent opacity-40"></div>
          <button onClick={handleCloseDialog} className="absolute top-1.5 right-1.5 md:top-2 md:right-2 text-[#FFD700]/30 hover:text-[#FFD700] transition-colors duration-300 z-20 p-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="md:w-3.5 md:h-3.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
          <div className="pt-1"><h3 className="font-playfair text-[#FFD700] text-[10px] md:text-sm text-center tracking-wide drop-shadow-sm select-none">Memorialize this moment</h3></div>
          <div className="relative group px-1">
              <input 
                ref={inputElRef}
                type="text" maxLength={20} placeholder="Add a short description..." defaultValue=""
                onChange={(e) => (nameRef.current = e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
                className="w-full bg-white/5 border border-[#FFD700]/10 text-[#FFD700] font-playfair px-2 py-2 md:px-3 md:py-2.5 rounded-sm outline-none placeholder-[#FFD700]/20 focus:border-[#FFD700]/40 focus:bg-white/10 transition-all text-center text-[16px] md:text-xs"
                autoFocus
                style={{ fontSize: '16px' }} 
              />
          </div>
          <div className="flex justify-between items-center mt-0.5 md:mt-1 px-1">
            <button onClick={handleCloseDialog} className="text-[#FFD700]/40 hover:text-[#FFD700] font-cinzel text-[7px] md:text-[8px] tracking-widest transition-colors uppercase">Cancel</button>
            <button onClick={handleNameSubmit} className="bg-[#FFD700] text-[#050f0a] font-cinzel font-bold text-[7px] md:text-[8px] px-3 py-1.5 md:px-5 md:py-2 rounded-sm hover:brightness-110 hover:shadow-[0_0_10px_rgba(255,215,0,0.3)] transition-all tracking-widest border border-white/10">SUBMIT</button>
          </div>
        </div>
      )}

      <div className={`absolute inset-0 z-10 pointer-events-none p-4 md:p-8 transition-opacity duration-1000 ${editingId || !hasStarted ? 'opacity-0' : 'opacity-100'}`}>
        <div className="absolute top-2 left-2 md:top-8 md:left-8 flex flex-col items-start pointer-events-auto origin-top-left scale-75 md:scale-90 lg:scale-100">
          <h1 className="font-cinzel text-3xl sm:text-4xl md:text-6xl text-transparent bg-clip-text bg-gradient-to-b from-[#FFD700] to-[#B8860B] drop-shadow-[0_2px_10px_rgba(255,215,0,0.4)] tracking-wider text-left leading-none animate-pulse">X'mastarfield</h1>
          <div className="h-[2px] w-24 md:w-48 bg-gradient-to-r from-[#FFD700] to-transparent mt-3 md:mt-4"></div>
        </div>

        <div className="absolute top-2 right-2 md:top-6 md:right-6 lg:top-8 lg:right-8 z-20 pointer-events-auto w-[130px] md:w-[220px] lg:w-[280px] origin-top-right scale-90 md:scale-100">
            <div className="bg-black/80 backdrop-blur-xl border border-[#FFD700]/40 p-1.5 md:p-4 lg:p-6 flex flex-col shadow-[0_0_40px_rgba(255,215,0,0.15)] rounded-sm transition-all duration-500 overflow-hidden">
                <div onClick={() => setIsPanelExpanded(!isPanelExpanded)} className="flex items-center justify-between cursor-pointer group hover:opacity-80 transition-all w-full">
                  <h2 className="text-[#FFD700] font-cinzel text-[10px] md:text-sm lg:text-lg tracking-widest drop-shadow-[0_0_5px_rgba(255,215,0,0.5)] uppercase font-bold text-left">SYSTEM PANEL</h2>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFD700" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-500 md:w-4 md:h-4 lg:w-5 lg:h-5 ${isPanelExpanded ? '' : '-rotate-90'}`}><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>

                <div className={`transition-all duration-700 ease-in-out overflow-hidden flex flex-col gap-1.5 md:gap-4 lg:gap-6 ${isPanelExpanded ? 'max-h-[1500px] opacity-100 mt-2 md:mt-5 lg:mt-8' : 'max-h-0 opacity-0'}`}>
                  <label className="cursor-pointer group relative w-full flex items-center justify-center py-1.5 md:py-3 lg:py-5 border border-[#FFD700] bg-black/40 hover:bg-[#FFD700]/10 transition-all duration-300 shadow-[0_0_15px_rgba(255,215,0,0.1)] rounded-sm">
                       <span className="font-cinzel text-[#FFD700] tracking-[0.2em] font-bold text-[8px] md:text-[10px] lg:text-sm group-hover:text-white transition-colors duration-300">ADD MEMORIES</span>
                       <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={!!editingId} />
                  </label>

                  <div className="border border-[#FFD700]/20 bg-black/20 p-1.5 md:p-3 lg:p-5 relative flex flex-col gap-2 md:gap-3 rounded-sm">
                      <div className="flex justify-between items-center border-b border-[#FFD700]/10 pb-1.5 md:pb-2">
                          <span className="text-[#FFD700]/70 font-cinzel text-[7px] md:text-[9px] lg:text-[11px] tracking-[0.2em] font-bold uppercase">BGM Player</span>
                          <div className={`w-1 h-1 md:w-1.5 md:h-1.5 rounded-full ${isPlaying ? 'bg-emerald-400 shadow-[0_0_5px_#34d399] animate-pulse' : 'bg-red-900'}`}></div>
                      </div>
                      <div className="overflow-hidden whitespace-nowrap bg-white/5 px-2 py-1 md:py-1.5 rounded-[1px]">
                          <p className="text-[#FFD700]/40 font-cinzel text-[6px] md:text-[7px] lg:text-[8px] uppercase tracking-widest mb-0.5 md:mb-1">Track {currentTrackIndex + 1} / {playlist.length}</p>
                          <p className="text-[#FFD700]/90 font-playfair text-[8px] md:text-[10px] lg:text-[12px] italic truncate">{playlist[currentTrackIndex].name}</p>
                      </div>
                      <div className="flex gap-1.5 md:gap-2 items-center">
                          <button onClick={handlePrevTrack} className="flex-1 flex items-center justify-center py-1.5 md:py-2 border border-[#FFD700]/20 bg-white/5 hover:bg-white/10 transition-all group rounded-[1px]"><svg xmlns="http://www.w3.org/2000/svg" className="w-2 h-2 md:w-3.5 md:h-3.5 text-[#FFD700]/60 group-hover:text-[#FFD700]" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg></button>
                          <button onClick={toggleMusic} className="flex-[1.5] flex items-center justify-center py-1.5 md:py-2 border border-[#FFD700]/50 bg-white/5 hover:bg-white/10 transition-all group rounded-[1px]">{isPlaying ? (<svg xmlns="http://www.w3.org/2000/svg" className="w-2 h-2 md:w-3.5 md:h-3.5 text-[#FFD700]" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>) : (<svg xmlns="http://www.w3.org/2000/svg" className="w-2 h-2 md:w-3.5 md:h-3.5 text-[#FFD700]" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>)}</button>
                          <button onClick={handleNextTrack} className="flex-1 flex items-center justify-center py-1.5 md:py-2 border border-[#FFD700]/20 bg-white/5 hover:bg-white/10 transition-all group rounded-[1px]"><svg xmlns="http://www.w3.org/2000/svg" className="w-2 h-2 md:w-3.5 md:h-3.5 text-[#FFD700]/60 group-hover:text-[#FFD700]" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg></button>
                      </div>
                      <div className="max-h-[40px] md:max-h-[100px] overflow-y-auto custom-scrollbar border-t border-[#FFD700]/10 pt-1.5 md:pt-2 flex flex-col gap-1 md:gap-1.5">
                          {playlist.map((track, idx) => (<button key={track.id} onClick={() => setCurrentTrackIndex(idx)} className={`text-left px-2 py-1 rounded-[1px] text-[7px] md:text-[9px] font-cinzel transition-colors ${currentTrackIndex === idx ? 'bg-[#FFD700]/15 text-[#FFD700]' : 'text-[#FFD700]/30 hover:text-[#FFD700]/60 hover:bg-white/5'}`}>{idx + 1}. {track.name}</button>))}
                      </div>
                      <label className="cursor-pointer flex items-center justify-center py-1.5 md:py-2 border border-[#FFD700]/30 bg-black/40 hover:bg-[#FFD700]/5 transition-all group rounded-[1px]"><span className="font-cinzel text-[#FFD700]/80 text-[7px] md:text-[9px] lg:text-[10px] tracking-widest font-bold group-hover:text-[#FFD700]">IMPORT PLAYLIST</span><input type="file" accept="audio/mp3,audio/mpeg" multiple className="hidden" onChange={handleMusicUpload} /></label>
                  </div>

                  {/* Redesigned Stylized Webcam Toggle */}
                  <div className="flex flex-col gap-2 md:gap-3">
                      <div className="flex items-center justify-between px-1.5">
                           <span className="font-cinzel text-[#FFD700] font-bold text-[6px] md:text-[8px] lg:text-[10px] tracking-[0.2em] drop-shadow-[0_0_2px_rgba(255,215,0,0.4)] uppercase">OPEN WEBCAM</span>
                           <div 
                             className={`relative w-7 h-3.5 md:w-10 md:h-5 lg:w-12 lg:h-6 rounded-full border border-[#FFD700] cursor-pointer transition-all duration-300 ${webcamEnabled ? 'bg-[#FFD700]/20 shadow-[0_0_10px_rgba(255,215,0,0.2)]' : 'bg-transparent'}`}
                             onClick={() => setWebcamEnabled(!webcamEnabled)}
                           >
                              <div className={`absolute top-[1.5px] left-[1.5px] w-2.5 h-2.5 md:top-[2px] md:left-[2px] md:w-3.5 md:h-3.5 lg:top-[2px] lg:left-[2px] lg:w-4.5 lg:h-4.5 rounded-full bg-[#FFD700] transition-transform duration-300 shadow-[0_0_8px_#FFD700] ${webcamEnabled ? 'translate-x-3 md:translate-x-4.5 lg:translate-x-5.5' : 'translate-x-0'}`}></div>
                           </div>
                      </div>
                      {webcamEnabled && (<GestureControl onGestureUpdate={handleGestureUpdate} enabled={webcamEnabled} />)}
                  </div>
                </div>
            </div>
        </div>
        <GestureInfoPanel mode={mode} gestureState={gestureState} />
      </div>
    </div>
  );
};

export default App;
