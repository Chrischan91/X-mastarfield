
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import '../types.ts'; 

const DustShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#FFFFFF') }
  },
  vertexShader: `
    uniform float uTime;
    attribute float aSize;
    attribute float aPhase;
    attribute float aSpeed;
    varying float vAlpha;

    void main() {
      vec3 pos = position;
      
      // Floating motion using sine waves for jitter/drift
      float t = uTime * aSpeed;
      pos.y += sin(t + aPhase) * 1.0;
      pos.x += cos(t * 0.8 + aPhase) * 1.0;
      pos.z += sin(t * 1.2 + aPhase) * 1.0;

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;

      // Breathing effect on size (pulsating)
      float breathe = 1.0 + sin(t * 2.0 + aPhase) * 0.3;
      
      // Size attenuation based on depth
      gl_PointSize = aSize * breathe * (300.0 / -mvPosition.z);
      
      // Fade out particles that are too close or too far to simulate depth of field/fog
      float dist = length(mvPosition.xyz);
      vAlpha = smoothstep(60.0, 40.0, dist) * smoothstep(2.0, 10.0, dist);
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    varying float vAlpha;

    void main() {
      // Circular particle shape
      vec2 center = gl_PointCoord - 0.5;
      float dist = length(center);
      if (dist > 0.5) discard;

      // Glow effect: Bright center, smooth falloff
      float glow = 1.0 - smoothstep(0.0, 0.5, dist);
      
      // Sharpen the core slightly while keeping soft edges
      glow = pow(glow, 1.5);

      // Output HDR color (multiplied by 2.0) to trigger Bloom effect
      gl_FragColor = vec4(uColor * 2.0, glow * vAlpha * 0.6);
    }
  `
};

export const DustSystem: React.FC = () => {
  const count = 2000;
  const shaderRef = useRef<THREE.ShaderMaterial>(null);

  const { positions, sizes, phases, speeds } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const speeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Spread particles in a large volume around the center
      pos[i * 3] = (Math.random() - 0.5) * 80;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 80;

      sizes[i] = Math.random() * 0.6 + 0.2;
      phases[i] = Math.random() * Math.PI * 2;
      speeds[i] = Math.random() * 0.5 + 0.1;
    }

    return { positions: pos, sizes, phases, speeds };
  }, []);

  useFrame((state) => {
    if (shaderRef.current) {
      shaderRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
    }
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-aSize" count={count} array={sizes} itemSize={1} />
        <bufferAttribute attach="attributes-aPhase" count={count} array={phases} itemSize={1} />
        <bufferAttribute attach="attributes-aSpeed" count={count} array={speeds} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        ref={shaderRef}
        args={[DustShader]}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};
