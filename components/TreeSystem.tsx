
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { AppMode, UploadedImage } from '../types.ts';
import { Image as DreiImage } from '@react-three/drei';

// --- HELPERS FOR NEW YEAR FORMATION ---

const generateNewYearPoints = (count: number, scale: number = 18, auraStart: number = Infinity, zThickness: number = 0.8) => {
    const nyPositions = new Float32Array(count * 3);
    if (typeof document === 'undefined') return nyPositions;
    
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024; 
    const ctx = canvas.getContext('2d');
    if (!ctx) return nyPositions;

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black';
    ctx.textAlign = 'center'; 
    ctx.textBaseline = 'middle';
    
    const cx = canvas.width / 2;
    // Use slightly tighter font spacing for better legibility in 3D
    ctx.font = 'bold 180px "Cinzel", serif';
    ctx.fillText('MERRY', cx, 420);
    ctx.font = 'bold 145px "Cinzel", serif';
    ctx.fillText('CHRISTMAS', cx, 600);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;
    const validCoords: [number, number][] = [];

    // Dense sampling for precise letter edges
    const step = 2; 
    for (let y = 0; y < canvas.height; y += step) {
        for (let x = 0; x < canvas.width; x += step) {
            const idx = (y * canvas.width + x) * 4;
            if (pixels[idx] < 128) {
                validCoords.push([x, y]);
            }
        }
    }

    const pool = validCoords.length > 0 ? validCoords : [[512, 512]];

    for (let i = 0; i < count; i++) {
        const coord = pool[Math.floor(Math.random() * pool.length)];
        
        let nx = (coord[0] / canvas.width - 0.5) * scale;
        let ny = (coord[1] / canvas.height - 0.5) * -scale;
        // Controlled thickness for the "body" of the letters
        let nz = (Math.random() - 0.5) * zThickness; 

        if (i >= auraStart) {
            // "Aura" particles that drift slightly around the letters
            const angle = Math.random() * Math.PI * 2;
            const dist = 0.2 + Math.random() * 0.5; 
            nx += Math.cos(angle) * dist;
            ny += Math.sin(angle) * dist;
            nz += (Math.random() - 0.5) * 1.5; 
        }
        
        nyPositions[i * 3] = nx;
        nyPositions[i * 3 + 1] = ny;
        nyPositions[i * 3 + 2] = nz;
    }

    return nyPositions;
};

// --- HERO STAR COMPONENT ---

const HeroStar = ({ mode }: { mode: AppMode }) => {
    const meshRef = useRef<THREE.Group>(null);
    
    const starShape = useMemo(() => {
        const shape = new THREE.Shape();
        const outerRadius = 0.5; 
        const innerRadius = 0.22;
        const spikes = 5;
        const step = Math.PI / spikes;
        
        shape.moveTo(0, outerRadius);
        for (let i = 1; i < spikes * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = i * step + Math.PI / 2;
            shape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        }
        shape.closePath();
        return new THREE.ExtrudeGeometry(shape, { 
            depth: 0.12, 
            bevelEnabled: true, 
            bevelThickness: 0.04, 
            bevelSize: 0.04 
        });
    }, []);

    const targetPos = useMemo(() => new THREE.Vector3(), []);
    
    useFrame((state) => {
        if (!meshRef.current) return;
        
        switch (mode) {
            case AppMode.TREE:
                targetPos.set(0, 8.8, 0); 
                break;
            case AppMode.SCATTER:
            case AppMode.FOCUS: 
                targetPos.set(0, 0, 0); 
                break;
            case AppMode.NEW_YEAR:
                // Moved higher to sit further above the 'M' per request
                targetPos.set(0, 4.3, 0.5); 
                break;
            default:
                targetPos.set(0, 8.8, 0);
        }

        const lerpSpeed = 0.05;
        meshRef.current.position.lerp(targetPos, lerpSpeed);
        
        const time = state.clock.getElapsedTime();
        meshRef.current.rotation.y = time * 0.4; 
        
        let baseScale = 0.75;
        if (mode === AppMode.SCATTER) baseScale = 0.95; 
        if (mode === AppMode.FOCUS) baseScale = 1.15; 
        if (mode === AppMode.NEW_YEAR) baseScale = 0.75; // Stayed smaller as requested earlier
        
        const isSteady = mode === AppMode.FOCUS;
        const twinkle = isSteady ? 1.0 : (1.0 + Math.sin(time * 2.5) * 0.08); 
        
        meshRef.current.scale.setScalar(baseScale * twinkle);
    });

    return (
        <group ref={meshRef}>
            <mesh geometry={starShape} renderOrder={999}>
                <meshStandardMaterial 
                    color="#FFD700" 
                    emissive="#FFD700" 
                    emissiveIntensity={2.5} 
                    metalness={1} 
                    roughness={0.02}
                />
            </mesh>
        </group>
    );
};

// --- SHADER DEFINITIONS ---

const FoliageMaterialConfig = {
  uniforms: {
    uTime: { value: 0 },
    uScatter: { value: 0 },
    uNewYear: { value: 0 },
    uColorBase: { value: new THREE.Color('#003300') }, 
    uColorGlow: { value: new THREE.Color('#00ff88') }, 
  },
  vertexShader: `
    uniform float uTime;
    uniform float uScatter;
    uniform float uNewYear;
    attribute vec3 aChaosPos;
    attribute vec3 aNewYearPos;
    attribute float aSize;
    attribute float aSpeed;
    varying float vAlpha;
    varying float vIsNewYear;

    void main() {
      vIsNewYear = uNewYear;
      vec3 treePos = position;
      treePos.x += sin(uTime * aSpeed + position.y) * 0.1;
      
      vec3 chaosPos = aChaosPos;
      chaosPos.x += sin(uTime * aSpeed + position.y) * 2.0;
      chaosPos.y += cos(uTime * aSpeed + position.x) * 2.0;

      vec3 nyPos = aNewYearPos;
      nyPos.z += sin(uTime * 12.0 + aSpeed * 40.0) * 0.01;

      vec3 currentPos = mix(treePos, chaosPos, uScatter);
      vec3 finalPos = mix(currentPos, nyPos, uNewYear);

      vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      
      // Kept scale factor modest for the text to avoid bloat
      float scaleFactor = mix(1.0, 1.25, uNewYear); 
      gl_PointSize = aSize * scaleFactor * (450.0 / -mvPosition.z);
      vAlpha = 1.0;
    }
  `,
  fragmentShader: `
    uniform vec3 uColorBase;
    uniform vec3 uColorGlow;
    varying float vIsNewYear;

    void main() {
      vec2 center = gl_PointCoord - 0.5;
      float dist = length(center);
      if (dist > 0.5) discard;
      float edgeGlow = smoothstep(0.1, 0.5, dist);
      
      // Further reduced glow component for text mode to lower overall brightness
      vec3 seasonalGlow = mix(uColorGlow, vec3(0.8, 0.7, 0.5), vIsNewYear * 0.3);
      
      // More aggressive brightness reduction for the text formation (0.6 instead of 0.8)
      float brightnessAdj = mix(1.0, 0.6, vIsNewYear);
      vec3 color = mix(uColorBase, seasonalGlow, edgeGlow * (0.3 + 0.4 * vIsNewYear)) * brightnessAdj;
      
      gl_FragColor = vec4(color, 1.0);
    }
  `
};

const SpiralMaterialConfig = {
  uniforms: {
    uTime: { value: 0 },
    uScatter: { value: 0 },
    uNewYear: { value: 0 },
    uColor: { value: new THREE.Color('#FFD700') },
  },
  vertexShader: `
    uniform float uTime;
    uniform float uScatter;
    uniform float uNewYear;
    attribute vec3 aChaosPos;
    attribute vec3 aNewYearPos;
    attribute float aSize;
    attribute float aPhase;
    varying float vAlpha;
    varying float vIsNewYear;

    void main() {
      vIsNewYear = uNewYear;
      vec3 treePos = position;
      float wave = sin(uTime * 2.0 + aPhase) * 0.1;
      treePos.x += wave;
      treePos.z += wave;

      vec3 currentPos = mix(treePos, aChaosPos, uScatter);
      vec3 finalPos = mix(currentPos, aNewYearPos, uNewYear);

      vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      
      // Softened size boost slightly for more delicate appearance
      float boost = mix(0.8, 0.55, uNewYear); 
      gl_PointSize = aSize * boost * (460.0 / -mvPosition.z) * (1.1 + sin(uTime * 2.5 + aPhase) * 0.5);
      vAlpha = 0.8 + 0.2 * sin(uTime * 1.5 + aPhase);
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    varying float vAlpha;
    varying float vIsNewYear;

    void main() {
      vec2 center = gl_PointCoord - 0.5;
      float dist = length(center);
      if (dist > 0.5) discard;
      float glow = 1.0 - smoothstep(0.0, 0.5, dist);
      
      // Slightly reduced intensity (brightness) for a softer golden glow per request
      // Ensuring it stays below bloom threshold primarily so physical objects stand out
      float intensity = mix(0.95, 0.75, vIsNewYear);
      gl_FragColor = vec4(uColor * intensity, glow * vAlpha * (intensity * 0.8));
    }
  `
};

const generateTreeData = (count: number) => {
  const positions = new Float32Array(count * 3);
  const chaosPositions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const speeds = new Float32Array(count);
  const height = 15;
  const maxRadius = 6;
  for (let i = 0; i < count; i++) {
    const y = Math.random() * height;
    const normY = y / height;
    const currentRadius = maxRadius * (1 - normY);
    const angle = Math.random() * Math.PI * 2 * (1 + normY * 10);
    const radiusOffset = Math.random() * currentRadius;
    const x = Math.cos(angle) * radiusOffset;
    const z = Math.sin(angle) * radiusOffset;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y - height / 2;
    positions[i * 3 + 2] = z;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const r = 20 + Math.random() * 20;
    chaosPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    chaosPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    chaosPositions[i * 3 + 2] = r * Math.cos(phi);
    sizes[i] = Math.random() * 0.45 + 0.15;
    speeds[i] = Math.random() * 0.5 + 0.1;
  }
  return { positions, chaosPositions, sizes, speeds };
};

const generateSpiralData = (count: number) => {
    const pos = new Float32Array(count * 3);
    const chaos = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const height = 16;
    const maxRadius = 6.8;
    const turns = 8;
    for(let i=0; i<count; i++) {
        const spiralIdx = i < count / 2 ? 0 : 1;
        const progress = (i % (count / 2)) / (count / 2);
        const y = progress * height - (height / 2);
        const radius = maxRadius * (1 - progress);
        const angle = progress * turns * Math.PI * 2 + (spiralIdx * Math.PI);
        const spread = (Math.random() - 0.5) * 0.4;
        pos[i * 3] = Math.cos(angle) * (radius + spread);
        pos[i * 3 + 1] = y + (Math.random() - 0.5) * 0.25;
        pos[i * 3 + 2] = Math.sin(angle) * (radius + spread);
        chaos[i * 3] = (Math.random() - 0.5) * 45;
        chaos[i * 3 + 1] = (Math.random() - 0.5) * 45;
        chaos[i * 3 + 2] = (Math.random() - 0.5) * 45;
        sizes[i] = Math.random() * 0.5 + 0.2;
        phases[i] = Math.random() * Math.PI * 2;
    }
    return { pos, chaos, sizes, phases };
};

const GoldenSpirals = React.memo(({ mode }: { mode: AppMode }) => {
    const shaderRef = useRef<THREE.ShaderMaterial>(null);
    const coreCount = 10000;
    const extraCount = 3000;
    const count = coreCount + extraCount;
    
    const { pos, chaos, sizes, phases } = useMemo(() => generateSpiralData(count), [count]);
    // Reduced zThickness (0.2) to make spirals sit flatter on the letters
    const nyPos = useMemo(() => generateNewYearPoints(count, 18, coreCount, 0.2), [count, coreCount]);

    useFrame((state) => {
        if (shaderRef.current) {
            shaderRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
            let targetScatter = 0;
            let targetNY = 0;
            if (mode === AppMode.SCATTER || mode === AppMode.FOCUS) targetScatter = 1;
            if (mode === AppMode.NEW_YEAR) targetNY = 1;
            shaderRef.current.uniforms.uScatter.value = THREE.MathUtils.lerp(shaderRef.current.uniforms.uScatter.value, targetScatter, 0.05);
            shaderRef.current.uniforms.uNewYear.value = THREE.MathUtils.lerp(shaderRef.current.uniforms.uNewYear.value, targetNY, 0.05);
        }
    });

    return (
        <points renderOrder={10}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" count={count} array={pos} itemSize={3} />
                <bufferAttribute attach="attributes-aChaosPos" count={count} array={chaos} itemSize={3} />
                <bufferAttribute attach="attributes-aNewYearPos" count={count} array={nyPos} itemSize={3} />
                <bufferAttribute attach="attributes-aSize" count={count} array={sizes} itemSize={1} />
                <bufferAttribute attach="attributes-aPhase" count={count} array={phases} itemSize={1} />
            </bufferGeometry>
            <shaderMaterial 
                ref={shaderRef} 
                uniforms={SpiralMaterialConfig.uniforms} 
                vertexShader={SpiralMaterialConfig.vertexShader} 
                fragmentShader={SpiralMaterialConfig.fragmentShader}
                transparent 
                depthWrite={false} 
                blending={THREE.AdditiveBlending} 
            />
        </points>
    );
});

const StaticTree = React.memo(({ mode, hasInput }: { mode: AppMode, hasInput: boolean }) => {
  const shaderRef = useRef<THREE.ShaderMaterial>(null);
  const foliageCount = 10000; 
  const { positions, chaosPositions, sizes, speeds } = useMemo(() => generateTreeData(foliageCount), [foliageCount]);
  const newYearPositions = useMemo(() => generateNewYearPoints(foliageCount, 18, Infinity, 0.8), [foliageCount]);
  const timeRef = useRef(0);

  useFrame((state, delta) => {
    if (!hasInput) timeRef.current += delta;
    const time = timeRef.current;
    if (shaderRef.current) {
      shaderRef.current.uniforms.uTime.value = time;
      let ts = 0, tn = 0;
      if (mode === AppMode.SCATTER || mode === AppMode.FOCUS) ts = 1;
      if (mode === AppMode.NEW_YEAR) tn = 1;
      shaderRef.current.uniforms.uScatter.value = THREE.MathUtils.lerp(shaderRef.current.uniforms.uScatter.value, ts, 0.05);
      shaderRef.current.uniforms.uNewYear.value = THREE.MathUtils.lerp(shaderRef.current.uniforms.uNewYear.value, tn, 0.05);
    }
  });

  return (
    <group>
      <points renderOrder={5}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={foliageCount} array={positions} itemSize={3} />
          <bufferAttribute attach="attributes-aChaosPos" count={foliageCount} array={chaosPositions} itemSize={3} />
          <bufferAttribute attach="attributes-aNewYearPos" count={foliageCount} array={newYearPositions} itemSize={3} />
          <bufferAttribute attach="attributes-aSize" count={foliageCount} array={sizes} itemSize={1} />
          <bufferAttribute attach="attributes-aSpeed" count={foliageCount} array={speeds} itemSize={1} />
        </bufferGeometry>
        <shaderMaterial 
            ref={shaderRef} 
            uniforms={FoliageMaterialConfig.uniforms}
            vertexShader={FoliageMaterialConfig.vertexShader}
            fragmentShader={FoliageMaterialConfig.fragmentShader}
            transparent 
            depthWrite={false} 
            blending={THREE.AdditiveBlending} 
        />
      </points>
      <GoldenSpirals mode={mode} />
    </group>
  );
});

interface TreeSystemProps {
  mode: AppMode;
  images: UploadedImage[];
  editingId: string | null;
  hasInput: boolean;
  focusId: string | null;
}

export const TreeSystem: React.FC<TreeSystemProps> = ({ mode, images, editingId, hasInput, focusId }) => {
  return (
    <group>
      <HeroStar mode={mode} />
      <StaticTree mode={mode} hasInput={hasInput} />
      {images && images.map((img, idx) => (
        <PolaroidPhoto 
          key={img.id} 
          image={img} 
          idx={idx} 
          mode={mode} 
          isEditing={editingId === img.id} 
          isFocused={focusId === img.id} 
          displayText={img.name || undefined} 
        />
      ))}
    </group>
  );
};

interface PolaroidPhotoProps {
    image: UploadedImage;
    idx: number;
    mode: AppMode;
    isEditing: boolean;
    isFocused: boolean;
    displayText?: string;
}

const PolaroidText = React.memo(({ text }: { text: string }) => {
    const canvas = useMemo(() => {
        const c = document.createElement('canvas');
        c.width = 1024; c.height = 256; return c;
    }, []);
    const texture = useMemo(() => {
        const t = new THREE.CanvasTexture(canvas);
        t.anisotropy = 16; return t;
    }, [canvas]);
    useEffect(() => {
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#000000';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            let fs = 100; ctx.font = `bold ${fs}px "Playfair Display", serif`;
            const textStr = text; 
            const mw = canvas.width * 0.9;
            let m = ctx.measureText(textStr);
            if (m.width > mw) { fs = Math.floor(fs * (mw / m.width)); ctx.font = `bold ${fs}px "Playfair Display", serif`; }
            ctx.fillText(textStr, canvas.width / 2, canvas.height / 2);
            texture.needsUpdate = true;
        }
    }, [text, canvas, texture]);
    return (
        <mesh position={[0, -0.47, 0.07]} renderOrder={100}>
            <planeGeometry args={[0.9, 0.225]} />
            <meshBasicMaterial map={texture} transparent toneMapped={false} />
        </mesh>
    );
});

const PolaroidPhoto = React.memo(({ image, idx, mode, isEditing, isFocused, displayText }: PolaroidPhotoProps) => {
    const groupRef = useRef<THREE.Group>(null);
    const { url } = image;
    const { size } = useThree();
    const isMobile = size.width < 768;
    const isTablet = size.width >= 768 && size.width < 1024;
    
    const { homePos, chaosPos, initialRotation, nyPos } = useMemo(() => {
        const h = new THREE.Vector3(...image.position);
        const c = h.clone().normalize().multiplyScalar(15 + Math.random() * 15);
        c.y += (Math.random() - 0.5) * 10;
        const rot = new THREE.Euler((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.2);
        
        // Photos are anchored slightly behind the surface for a depth effect
        const rawPoints = generateNewYearPoints(100, 18, Infinity, 0.1);
        const pIdx = Math.floor(Math.random() * 100);
        const ny = new THREE.Vector3(rawPoints[pIdx * 3], rawPoints[pIdx * 3 + 1], -0.2);
        
        return { homePos: h, chaosPos: c, initialRotation: rot, nyPos: ny };
    }, [image.position]); 

    const targetQ = useMemo(() => new THREE.Quaternion(), []);
    const parentQ = useMemo(() => new THREE.Quaternion(), []);
    const camQ = useMemo(() => new THREE.Quaternion(), []);

    useFrame((state) => {
        const scatterVal = (mode === AppMode.SCATTER || (mode === AppMode.FOCUS && !isFocused)) ? 1 : 0;
        const lerpSpeed = (mode === AppMode.FOCUS && isFocused) ? 0.25 : 0.08;

        let targetPos = new THREE.Vector3();
        let targetScale = 1;
        let targetRot = initialRotation.clone(); 
        let lookAtCamera = false;

        if (isEditing) {
            const dist = 10; 
            const vec = new THREE.Vector3(0, isMobile ? 0.8 : 0.4, -dist);
            vec.applyQuaternion(state.camera.quaternion);
            vec.add(state.camera.position);
            if (groupRef.current?.parent) {
                groupRef.current.parent.updateWorldMatrix(true, false);
                targetPos.copy(vec);
                groupRef.current.parent.worldToLocal(targetPos);
            } else { targetPos.copy(vec); }
            targetScale = isMobile ? 1.2 : 1.1; 
            lookAtCamera = true;
        } else if (mode === AppMode.FOCUS && isFocused) {
            const dist = 12; 
            const cam = state.camera as THREE.PerspectiveCamera;
            const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * dist;
            const visibleWidth = visibleHeight * cam.aspect;
            
            let wf = 0.42, hf = 0.42; 
            if (isMobile) { wf = 0.62; hf = 0.55; } else if (isTablet) { wf = 0.48; hf = 0.45; }
            
            targetScale = Math.min((visibleWidth * wf) / 1.02, (visibleHeight * hf) / 1.24);
            const vec = new THREE.Vector3(0, 0, -dist).applyQuaternion(state.camera.quaternion).add(state.camera.position);
            if (groupRef.current?.parent) {
                groupRef.current.parent.updateWorldMatrix(true, false);
                targetPos.copy(vec);
                groupRef.current.parent.worldToLocal(targetPos);
            } else { targetPos.copy(vec); }
            lookAtCamera = true;
        } else if (mode === AppMode.NEW_YEAR) {
            targetPos.copy(nyPos);
            targetScale = 0.22; 
            targetRot.set(0, 0, 0);
            lookAtCamera = true;
        } else {
            targetPos.lerpVectors(homePos, chaosPos, scatterVal);
            targetPos.y += Math.sin(state.clock.elapsedTime + idx) * 0.005;
            if (scatterVal > 0.5) {
                targetRot.x += state.clock.getElapsedTime() * 0.2;
                targetRot.y += state.clock.getElapsedTime() * 0.3;
            } else {
                targetRot.z += Math.sin(state.clock.elapsedTime * 0.5 + idx) * 0.05;
            }
        }
        
        if (lookAtCamera) {
            camQ.copy(state.camera.quaternion);
            if (groupRef.current?.parent) {
                groupRef.current.parent.getWorldQuaternion(parentQ);
                camQ.premultiply(parentQ.invert());
            }
            targetQ.copy(camQ);
        } else {
            targetQ.setFromEuler(targetRot);
        }

        if (groupRef.current) {
            groupRef.current.position.lerp(targetPos, lerpSpeed);
            groupRef.current.scale.setScalar(THREE.MathUtils.lerp(groupRef.current.scale.x, targetScale, lerpSpeed));
            groupRef.current.quaternion.slerp(targetQ, lerpSpeed);
        }
    });

    return (
        <group ref={groupRef} renderOrder={50}>
            {/* Main White Frame - Increased emissive for higher brightness */}
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[1, 1.22, 0.05]} />
                <meshStandardMaterial 
                    color="#FFFFFF" 
                    metalness={0.1} 
                    roughness={0.4} 
                    emissive="#FFFFFF" 
                    emissiveIntensity={0.45} 
                />
            </mesh>
            <group position={[0, 0.125, 0.03]}>
               <DreiImage url={url} scale={[0.9, 0.9]} toneMapped={false} />
               <mesh position={[0,0,0.01]}>
                  <planeGeometry args={[0.9, 0.9]} />
                  <meshPhysicalMaterial transparent opacity={0.15} roughness={0.0} metalness={0.1} clearcoat={1} />
               </mesh>
            </group>
            {displayText && <PolaroidText text={displayText} />}
            {/* Gold Border - Added emissive to make it shine and pop */}
            <mesh position={[0, 0, -0.01]}>
                <boxGeometry args={[1.02, 1.24, 0.04]} />
                <meshStandardMaterial 
                    color="#FFD700" 
                    metalness={1} 
                    roughness={0.2} 
                    emissive="#FFD700" 
                    emissiveIntensity={0.35}
                />
            </mesh>
        </group>
    )
});
