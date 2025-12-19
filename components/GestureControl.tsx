
import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import { GestureState } from '../types';

interface GestureControlProps {
  onGestureUpdate: (state: GestureState) => void;
  enabled: boolean;
}

export const GestureControl: React.FC<GestureControlProps> = ({ onGestureUpdate, enabled }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  const onGestureUpdateRef = useRef(onGestureUpdate);

  useEffect(() => {
    onGestureUpdateRef.current = onGestureUpdate;
  }, [onGestureUpdate]);

  useEffect(() => {
    const initMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
        );
        
        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
        setModelLoaded(true);
      } catch (err) {
        console.error("MediaPipe initialization failed:", err);
      }
    };

    initMediaPipe();
  }, []);

  useEffect(() => {
    if (enabled) {
      startWebcam();
    } else {
      stopWebcam();
    }
    return () => stopWebcam();
  }, [enabled]);

  const startWebcam = () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 } }).then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadeddata = () => {
              videoRef.current?.play().catch(e => console.error("Play error:", e));
              setPermissionGranted(true);
              predictWebcam();
          };
        }
      }).catch(err => {
          console.warn("Webcam access failed:", err);
          setPermissionGranted(false);
      });
    }
  };

  const stopWebcam = () => {
      if (requestRef.current) {
          cancelAnimationFrame(requestRef.current);
          requestRef.current = 0;
      }
      if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
      }
      if (videoRef.current) {
          videoRef.current.srcObject = null;
      }
      setPermissionGranted(false);
      onGestureUpdateRef.current({ x: 0, y: 0, handSize: 0, isDetected: false, gesture: 'NONE' });
  };

  const predictWebcam = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return;
    if (!handLandmarkerRef.current) {
        requestRef.current = requestAnimationFrame(predictWebcam);
        return;
    }

    const landmarker = handLandmarkerRef.current;
    const startTimeMs = performance.now();
    let results;
    try {
        results = landmarker.detectForVideo(video, startTimeMs);
    } catch(e) {
        requestRef.current = requestAnimationFrame(predictWebcam);
        return;
    }

    const ctx = canvas.getContext("2d");
    if(ctx) {
        if (video.videoWidth && canvas.width !== video.videoWidth) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    let gesture: 'FIST' | 'OPEN_PALM' | 'PINCH' | 'YEAH' | 'NONE' = 'NONE';
    let x = 0;
    let y = 0;
    let handSize = 0;
    let isDetected = false;

    if (results && results.landmarks && results.landmarks.length > 0) {
      const landmarks = results.landmarks[0];
      if (landmarks && landmarks.length >= 21) {
        isDetected = true;
        if (ctx) {
          const drawingUtils = new DrawingUtils(ctx);
          drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: "#FFD700", lineWidth: 2 });
          drawingUtils.drawLandmarks(landmarks, { color: "#00FF00", lineWidth: 1, radius: 2 });
        }

        const wrist = landmarks[0];
        const middleMCP = landmarks[9]; 
        
        x = (middleMCP.x - 0.5) * -2; 
        y = (middleMCP.y - 0.5) * 2;  
        
        handSize = Math.hypot(middleMCP.x - wrist.x, middleMCP.y - wrist.y);

        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const middleTip = landmarks[12];
        const ringTip = landmarks[16];
        const pinkyTip = landmarks[20];

        const pinchDist = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
        const distIndex = Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y);
        const distMiddle = Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y);
        const distRing = Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y);
        const distPinky = Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y);

        const avgFingerDist = (distIndex + distMiddle + distRing + distPinky) / 4;

        if (avgFingerDist < 0.23) {
          gesture = 'FIST'; 
        } else if (distIndex > 0.35 && distMiddle > 0.35 && distRing < 0.25 && distPinky < 0.25) {
          gesture = 'YEAH';
        } else if (pinchDist < 0.08) {
          gesture = 'PINCH'; 
        } else if (avgFingerDist > 0.38) {
          gesture = 'OPEN_PALM'; 
        }
      }
    }

    onGestureUpdateRef.current({ x, y, handSize, isDetected, gesture });
    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  if (!enabled) return null;

  return (
    <div className="w-full transition-opacity duration-300 select-none rounded-sm overflow-hidden bg-black/40 border border-[#FFD700]/20">
       <div className="relative w-full aspect-video bg-black/80">
          <video ref={videoRef} autoPlay playsInline muted className="absolute w-full h-full object-cover transform scale-x-[-1]" />
          <canvas ref={canvasRef} className="absolute w-full h-full object-cover transform scale-x-[-1]" />
          
          {(!permissionGranted || !modelLoaded) && (
             <div className="absolute inset-0 flex items-center justify-center text-center bg-black/95 z-10 p-2">
                <div className="flex flex-col items-center gap-2">
                   <div className="w-5 h-5 border border-[#FFD700]/10 border-t-[#FFD700] rounded-full animate-spin"></div>
                   <span className="text-[7px] md:text-[8px] text-[#FFD700]/70 font-cinzel tracking-[0.2em] animate-pulse uppercase leading-relaxed">
                      {!permissionGranted ? "Awaiting camera..." : "Initializing AI..."}
                   </span>
                </div>
             </div>
          )}

          <div className="absolute top-1 left-1 flex items-center gap-1.5 pointer-events-none px-1.5 py-0.5 bg-black/60 rounded-[1px] border border-[#FFD700]/10">
              <div className={`w-1 h-1 rounded-full ${permissionGranted && modelLoaded ? 'bg-emerald-400 shadow-[0_0_5px_#34d399]' : 'bg-red-500 shadow-[0_0_5px_#ef4444]'}`}></div>
              <span className="text-[6px] md:text-[7px] font-cinzel text-[#FFD700]/80 tracking-widest font-bold">LIVE FEED</span>
          </div>
       </div>
    </div>
  );
};
