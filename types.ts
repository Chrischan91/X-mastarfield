
import 'react';

export enum AppMode {
  TREE = 'TREE',
  SCATTER = 'SCATTER',
  FOCUS = 'FOCUS',
  NEW_YEAR = 'NEW_YEAR'
}

export interface ParticleData {
  id: string;
  initialPos: [number, number, number]; // Chaos position
  targetPos: [number, number, number];  // Tree position
  scale: number;
  color: string;
  type: 'foliage' | 'ornament' | 'light' | 'gift';
}

export interface UploadedImage {
  id: string;
  url: string;
  position: [number, number, number];
  name?: string;
}

export interface GestureState {
  x: number; // Normalized -1 to 1
  y: number; // Normalized -1 to 1
  handSize: number; // Proxy for distance/depth
  isDetected: boolean;
  gesture: 'FIST' | 'OPEN_PALM' | 'PINCH' | 'YEAH' | 'NONE';
}

// Augment global JSX namespace to include Three.js elements for general compatibility
declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      points: any;
      bufferGeometry: any;
      bufferAttribute: any;
      shaderMaterial: any;
      instancedMesh: any;
      tetrahedronGeometry: any;
      meshStandardMaterial: any;
      mesh: any;
      planeGeometry: any;
      meshBasicMaterial: any;
      boxGeometry: any;
      meshPhysicalMaterial: any;
      ambientLight: any;
      pointLight: any;
      sphereGeometry: any;
      tubeGeometry: any;
      color: any;
      [elemName: string]: any;
    }
  }
}
