
import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, OrbitControls, Stars, Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { TreeSystem } from './TreeSystem.tsx';
import { Ornaments } from './Ornaments.tsx';
import { DustSystem } from './DustSystem.tsx';
import { AppMode, GestureState, UploadedImage } from '../types.ts';

const CameraController: React.FC<{ mode: AppMode; gestureState: GestureState }> = ({ mode, gestureState }) => {
  const { camera } = useThree();
  const baseZ = 38;
  const defaultLookAt = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const lastMode = useRef(mode);
  const currentZoomZ = useRef(baseZ);

  useFrame(() => {
    if (gestureState.isDetected) {
      const targetZ = THREE.MathUtils.mapLinear(
        THREE.MathUtils.clamp(gestureState.handSize || 0, 0.08, 0.45),
        0.08, 0.45,
        65, 12
      );
      currentZoomZ.current = THREE.MathUtils.lerp(currentZoomZ.current, targetZ, 0.05);
    } else {
      currentZoomZ.current = THREE.MathUtils.lerp(currentZoomZ.current, baseZ, 0.05);
    }

    if (mode === AppMode.NEW_YEAR) {
      const isInitialTransition = lastMode.current !== AppMode.NEW_YEAR;
      const lerpFactor = isInitialTransition ? 0.15 : 0.02; 
      
      const targetPos = new THREE.Vector3(0, 0, currentZoomZ.current);
      if (camera.position.distanceTo(targetPos) > 0.01) {
         camera.position.lerp(targetPos, lerpFactor);
         camera.lookAt(defaultLookAt);
      }
      
      if (isInitialTransition && camera.position.distanceTo(targetPos) < 0.1) {
          lastMode.current = AppMode.NEW_YEAR;
      }
    } else {
      lastMode.current = mode;
      
      if (gestureState.isDetected && mode !== AppMode.FOCUS) {
          const currentDir = new THREE.Vector3().subVectors(camera.position, defaultLookAt).normalize();
          const targetPos = currentDir.multiplyScalar(currentZoomZ.current);
          camera.position.lerp(targetPos, 0.05);
      }
    }
  });

  return null;
};

const SceneGroup: React.FC<{ gestureState: GestureState; mode: AppMode; children: React.ReactNode; isFrozen: boolean }> = ({ gestureState, mode, children, isFrozen }) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      if (mode === AppMode.NEW_YEAR) {
        const lerpFactor = 0.1;
        groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, 0, lerpFactor);
        groupRef.current.rotation.y = THREE_ACTUAL.MathUtils.lerp(groupRef.current.rotation.y, 0, lerpFactor);
        groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, 0, lerpFactor);
      } else if (!isFrozen) {
        if (mode === AppMode.TREE) {
          const lerpFactor = 0.05;
          groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, 0, lerpFactor);
          groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, 0, lerpFactor);
          groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, 0, lerpFactor);
        } else {
          let targetRotY = state.mouse.x * 0.3;
          let targetRotX = state.mouse.y * 0.1;

          if (gestureState.isDetected) {
             targetRotY = gestureState.x * 1.5; 
             targetRotX = gestureState.y * 0.5;
          }

          const lf = 0.05;
          groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, lf);
          groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotX, lf);
          groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, 0, lf);
        }
      }
    }
  });

  return <group ref={groupRef}>{children}</group>;
};

interface ExperienceProps {
  mode: AppMode;
  gestureState: GestureState;
  images: UploadedImage[];
  editingId: string | null;
  hasInput: boolean;
  focusId: string | null;
}

const THREE_ACTUAL = THREE; // Helper for consistency

export const Experience: React.FC<ExperienceProps> = ({ mode, gestureState, images, editingId, hasInput, focusId }) => {
  const isFocusMode = mode === AppMode.FOCUS;
  const isEditing = !!editingId;
  
  const shouldFreezeScene = isEditing || isFocusMode;
  const enableControls = !isEditing && !isFocusMode;

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 38], fov: 45 }}
      gl={{ 
        antialias: true, 
        toneMapping: THREE.ACESFilmicToneMapping, 
        toneMappingExposure: 1.1 
      }}
    >
      <color attach="background" args={['#010502']} />
      <CameraController mode={mode} gestureState={gestureState} />
      
      {/* Higher ambient light for clearer ornaments */}
      <ambientLight intensity={3.5} color="#203025" />
      
      {/* Repositioned and boosted point lights for better highlight catch on materials */}
      <pointLight position={[25, 25, 25]} intensity={600} color="#FFD700" distance={150} decay={2} />
      <pointLight position={[-25, 10, 25]} intensity={500} color="#FF4444" distance={150} decay={2} />
      <pointLight position={[0, -15, 25]} intensity={400} color="#FFFFFF" distance={100} decay={1.5} />

      <Stars radius={150} depth={80} count={10000} factor={6} saturation={0.5} fade speed={1} />
      <Sparkles count={500} scale={25} size={3.5} speed={0.8} opacity={0.8} color="#FFD700" />
      <DustSystem />
      <Environment preset="night" environmentIntensity={1.2} />

      <OrbitControls 
        makeDefault 
        enableZoom={true} 
        enablePan={false} 
        enableRotate={true}
        minDistance={10}
        maxDistance={120}
        target={[0, 0, 0]}
        enableDamping={true}
        dampingFactor={0.05}
        enabled={enableControls}
      />

      <SceneGroup gestureState={gestureState} mode={mode} isFrozen={shouldFreezeScene}>
        <TreeSystem mode={mode} images={images} editingId={editingId} hasInput={hasInput} focusId={focusId} />
        <Ornaments mode={mode} hasInput={hasInput} />
      </SceneGroup>

      <EffectComposer disableNormalPass multisampling={4}>
        <Bloom 
            luminanceThreshold={0.65} 
            mipmapBlur 
            intensity={1.0} 
            radius={0.7}
            color="#FFD700"
        />
        <Vignette eskil={false} offset={0.2} darkness={1.1} />
      </EffectComposer>
    </Canvas>
  );
};
