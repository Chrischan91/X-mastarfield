
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AppMode } from '../types.ts';

// --- UTILS ---

const mergeGeometries = (geometries: THREE.BufferGeometry[]) => {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    let vertexOffset = 0;
    
    if (!geometries || geometries.length === 0) return new THREE.BufferGeometry();

    geometries.forEach(geo => {
        if (!geo || !geo.attributes || !geo.attributes.position) return;
        const posAttr = geo.attributes.position;
        const normAttr = geo.attributes.normal;
        const uvAttr = geo.attributes.uv;
        const indexAttr = geo.index;
        
        for (let i = 0; i < posAttr.count; i++) {
            positions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
            if (normAttr) normals.push(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
            if (uvAttr) uvs.push(uvAttr.getX(i), uvAttr.getY(i));
        }
        
        if (indexAttr) {
            for (let i = 0; i < indexAttr.count; i++) {
                indices.push(indexAttr.getX(i) + vertexOffset);
            }
        } else {
             for (let i = 0; i < posAttr.count; i++) {
                indices.push(i + vertexOffset);
            }
        }
        vertexOffset += posAttr.count;
    });
    
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    if (normals.length > 0) merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    if (uvs.length > 0) merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    merged.setIndex(indices);
    return merged;
};

const createRibbonGeometry = () => {
    const geometries: THREE.BufferGeometry[] = [];
    const bw = 0.2, bt = 1.02;
    geometries.push(new THREE.BoxGeometry(bw, bt, bt), new THREE.BoxGeometry(bt, bt, bw));
    const lr = 0.25, lt = 0.08;
    const l1 = new THREE.TorusGeometry(lr, lt, 8, 16);
    l1.rotateX(Math.PI / 2); l1.rotateY(Math.PI / 4); l1.translate(-0.15, 0.55, 0);
    geometries.push(l1);
    const l2 = new THREE.TorusGeometry(lr, lt, 8, 16);
    l2.rotateX(Math.PI / 2); l2.rotateY(-Math.PI / 4); l2.translate(0.15, 0.55, 0);
    geometries.push(l2);
    const k = new THREE.SphereGeometry(0.12, 8, 8);
    k.scale(1, 0.6, 1); k.translate(0, 0.55, 0);
    geometries.push(k);
    return mergeGeometries(geometries);
};

const createCandyCaneTexture = () => {
  if (typeof document === 'undefined') return new THREE.Texture();
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  if (!ctx) return new THREE.Texture();
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#D6001C'; 
  ctx.beginPath();
  for (let i = -128; i < 256; i += 32) {
      ctx.moveTo(i, 0); ctx.lineTo(i + 16, 0);
      ctx.lineTo(i + 16 + 128, 128); ctx.lineTo(i + 128, 128);
      ctx.closePath();
  }
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 4); 
  return t;
};

const createGlitterTexture = () => {
    if (typeof document === 'undefined') return new THREE.Texture();
    const s = 512;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d');
    if (!ctx) return new THREE.Texture();
    const img = ctx.createImageData(s, s);
    for (let i = 0; i < s * s; i++) {
        const idx = i * 4, v = Math.random() > 0.5 ? 255 : 0; 
        img.data[idx] = img.data[idx+1] = img.data[idx+2] = v;
        img.data[idx+3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3);
    return t;
};

const createCandyCaneCurve = () => {
    return new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 2.5, 0), 
        new THREE.Vector3(0.5, 3.0, 0), new THREE.Vector3(1.2, 2.3, 0), 
    ]);
};

// Tightened sampling and controlled Z thickness for "embossed" look
const generateNewYearPoints = (count: number, scale: number = 18, zOffset: number = 0.2, zVariation: number = 0.3) => {
    const res: THREE.Vector3[] = [];
    if (typeof document === 'undefined') {
        for(let i=0; i<count; i++) res.push(new THREE.Vector3(0,0,0));
        return res;
    }
    
    const c = document.createElement('canvas');
    c.width = c.height = 1024;
    const ctx = c.getContext('2d');
    if (!ctx) {
        for(let i=0; i<count; i++) res.push(new THREE.Vector3(0,0,0));
        return res;
    }
    
    ctx.fillStyle = 'white'; 
    ctx.fillRect(0, 0, 1024, 1024);
    ctx.fillStyle = 'black'; 
    ctx.textAlign = 'center'; 
    ctx.textBaseline = 'middle';
    
    const cx = 512;
    ctx.font = 'bold 180px "Cinzel", serif';
    ctx.fillText('MERRY', cx, 420);
    ctx.font = 'bold 145px "Cinzel", serif';
    ctx.fillText('CHRISTMAS', cx, 600);

    const img = ctx.getImageData(0, 0, 1024, 1024);
    const pix = img.data;
    const decorationPool: [number, number][] = [];
    
    // Dense step for precision
    const step = 2; 
    for (let y = 100; y < 924; y += step) { 
        for (let x = 50; x < 974; x += step) {
            const idx = (y * 1024 + x) * 4;
            if (pix[idx] < 128) {
                decorationPool.push([x, y]);
            }
        }
    }

    const pool = decorationPool.length > 0 ? decorationPool : [[512, 512]];
    
    for (let i = 0; i < count; i++) {
        // Uniform distribution across all letters
        const coord = pool[Math.floor(Math.random() * pool.length)];
        const nx = (coord[0] / 1024 - 0.5) * scale;
        const ny = (coord[1] / 1024 - 0.5) * -scale;
        
        // Varying depth within the letter volume
        const nz = zOffset + (Math.random() - 0.5) * zVariation; 
        res.push(new THREE.Vector3(nx, ny, nz));
    }
    return res;
};

const useOrnamentData = (count: number, scatterRadius: number, zBase: number, zVar: number) => {
  return useMemo(() => {
    const data = [];
    const height = 15;
    const maxRadius = 6.0; 
    const nyPosList = generateNewYearPoints(count, 18, zBase, zVar);
    for (let i = 0; i < count; i++) {
        const y = Math.random() * height, radius = maxRadius * (1 - (y / height)) * 0.8; 
        const angle = Math.random() * Math.PI * 2;
        const treePos = new THREE.Vector3(Math.cos(angle) * radius, y - height / 2, Math.sin(angle) * radius);
        const theta = Math.random() * Math.PI * 2, phi = Math.acos(Math.random() * 2 - 1);
        const r = scatterRadius + Math.random() * 10;
        const chaosPos = new THREE.Vector3(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi));
        const nyPos = nyPosList[i] || new THREE.Vector3(0,0,0);
        data.push({ treePos, chaosPos, nyPos, rotation: new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI), id: i });
    }
    return data;
  }, [count, scatterRadius, zBase, zVar]);
};

interface OrnamentsProps {
    mode: AppMode;
    hasInput: boolean;
}

export const Ornaments: React.FC<OrnamentsProps> = ({ mode, hasInput }) => {
    // Gift boxes layered deepest (Z: 0.1)
    const goldBoxCount = 45, greenBoxCount = 45;
    const boxData = useOrnamentData(goldBoxCount + greenBoxCount, 15, 0.1, 0.2);
    const goldBoxData = boxData.slice(0, goldBoxCount), greenBoxData = boxData.slice(goldBoxCount);
    
    // Spheres layered mid-depth (Z: 0.25)
    const sphereCount = 140;
    const spheresDataRaw = useOrnamentData(sphereCount, 18, 0.25, 0.3);
    const redSphereData = spheresDataRaw.slice(0, 70), silverSphereData = spheresDataRaw.slice(70);
    
    // Candy canes and lights layered forward (Z: 0.4)
    const caneCount = 50, caneData = useOrnamentData(caneCount, 20, 0.4, 0.2);
    const lightCount = 400, lightData = useOrnamentData(lightCount, 16, 0.3, 0.1);

    const goldBoxBodyRef = useRef<THREE.InstancedMesh>(null), goldBoxRibbonRef = useRef<THREE.InstancedMesh>(null);
    const greenBoxBodyRef = useRef<THREE.InstancedMesh>(null), greenBoxRibbonRef = useRef<THREE.InstancedMesh>(null);
    const redSphereMeshRef = useRef<THREE.InstancedMesh>(null), silverSphereMeshRef = useRef<THREE.InstancedMesh>(null);
    const caneMeshRef = useRef<THREE.InstancedMesh>(null), lightMeshRef = useRef<THREE.InstancedMesh>(null);
    
    const ribbonGeometry = useMemo(() => createRibbonGeometry(), []);
    const boxGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
    const caneCurve = useMemo(() => createCandyCaneCurve(), []), caneTexture = useMemo(() => createCandyCaneTexture(), []);
    const glitterTexture = useMemo(() => createGlitterTexture(), []), dummy = useMemo(() => new THREE.Object3D(), []), lightColor = useMemo(() => new THREE.Color(), []);

    const sRef = useRef(0), nRef = useRef(0), timeRef = useRef(0);

    useFrame((state, delta) => {
        if (!hasInput) timeRef.current += delta;
        const time = timeRef.current;
        let ts = 0, tn = 0;
        if (mode === AppMode.SCATTER || mode === AppMode.FOCUS) ts = 1; 
        if (mode === AppMode.NEW_YEAR) tn = 1;
        sRef.current = THREE.MathUtils.lerp(sRef.current, ts, 0.05);
        nRef.current = THREE.MathUtils.lerp(nRef.current, tn, 0.05);
        const s = sRef.current, n = nRef.current;

        const updateMesh = (data: any[], meshBody: any, meshRibbon: any, scale: number, type: 'box' | 'sphere' | 'cane' | 'light') => {
            if (!data) return;
            const body = meshBody.current;
            const ribbon = meshRibbon?.current;
            if (!body) return;

            data.forEach((d, i) => {
                const p = new THREE.Vector3().lerpVectors(new THREE.Vector3().lerpVectors(d.treePos, d.chaosPos, s), d.nyPos, n);
                dummy.position.copy(p);
                
                if (n > 0.01) {
                    const targetEuler = new THREE.Euler(0, 0, 0);
                    if (type === 'box') {
                        // Align more towards the surface
                        targetEuler.z = (Math.sin(i * 1.5) * 0.2);
                        targetEuler.x = (Math.cos(i * 2.0) * 0.1);
                        targetEuler.y = (Math.sin(i * 0.5) * 0.1);
                    } else if (type === 'cane') {
                        targetEuler.x = -Math.PI / 2;
                        targetEuler.z = (i % 2 === 0 ? 0.4 : -0.4);
                    } else if (type === 'sphere') {
                        targetEuler.y = time * 0.2 + i;
                    }
                    
                    const qA = new THREE.Quaternion().setFromEuler(d.rotation);
                    const qB = new THREE.Quaternion().setFromEuler(targetEuler);
                    dummy.quaternion.copy(qA).slerp(qB, n);
                } else {
                    dummy.rotation.copy(d.rotation);
                    dummy.rotation.x += time * (0.1 + n * 0.2); 
                    dummy.rotation.z += n * Math.sin(time + i) * 0.1;
                }

                // Tighten scaling in text mode to ensure character legibility
                let nScale = scale * (1 + Math.sin(time + i) * 0.05);
                if (n > 0.5) {
                    // Reduce size by ~40% to prevent overlapping within the text strokes
                    nScale *= (1.0 - (n - 0.5) * 0.5); 
                }
                
                dummy.scale.setScalar(nScale);
                dummy.updateMatrix();
                
                body.setMatrixAt(i, dummy.matrix);
                if (ribbon) ribbon.setMatrixAt(i, dummy.matrix);
            });
            body.instanceMatrix.needsUpdate = true;
            if (ribbon) ribbon.instanceMatrix.needsUpdate = true;
        };

        updateMesh(goldBoxData, goldBoxBodyRef, goldBoxRibbonRef, 0.28, 'box');
        updateMesh(greenBoxData, greenBoxBodyRef, greenBoxRibbonRef, 0.25, 'box');
        updateMesh(redSphereData, redSphereMeshRef, null, 0.18, 'sphere');
        updateMesh(silverSphereData, silverSphereMeshRef, null, 0.16, 'sphere');
        updateMesh(caneData, caneMeshRef, null, 0.14, 'cane');
        
        if (lightMeshRef.current) {
            const lMesh = lightMeshRef.current;
            lightData.forEach((d, i) => {
                const p = new THREE.Vector3().lerpVectors(new THREE.Vector3().lerpVectors(d.treePos, d.chaosPos, s), d.nyPos, n);
                dummy.position.copy(p); 
                dummy.scale.setScalar(0.04 * (1 + n * 0.05)); 
                dummy.updateMatrix(); 
                lMesh.setMatrixAt(i, dummy.matrix);
                const w = Math.sin(time * 8 + i * 0.5) * 0.5 + 0.5;
                // Softened the base color for New Year mode to contribute to lower brightness
                const baseColor = n > 0.5 ? '#998844' : '#FFD700'; 
                lightColor.set(baseColor).lerp(new THREE.Color('#FFF5E1'), w);
                lMesh.setColorAt(i, lightColor);
            });
            lMesh.instanceMatrix.needsUpdate = true;
            if (lMesh.instanceColor) lMesh.instanceColor.needsUpdate = true;
        }
    });

    return (
        <group>
            <group>
                <instancedMesh ref={goldBoxBodyRef} args={[undefined, undefined, goldBoxCount]}>
                    <primitive object={boxGeometry} attach="geometry" />
                    <meshStandardMaterial color="#FFD700" metalness={0.8} roughness={0.2} emissive="#443300" emissiveIntensity={0.15} />
                </instancedMesh>
                <instancedMesh ref={goldBoxRibbonRef} args={[undefined, undefined, goldBoxCount]}>
                    <primitive object={ribbonGeometry} attach="geometry" />
                    <meshStandardMaterial color="#D6001C" metalness={0.9} roughness={0.1} emissive="#330000" />
                </instancedMesh>
            </group>
            <group>
                <instancedMesh ref={greenBoxBodyRef} args={[undefined, undefined, greenBoxCount]}>
                    <primitive object={boxGeometry} attach="geometry" />
                    <meshStandardMaterial color="#004033" metalness={0.6} roughness={0.4} emissive="#001108" emissiveIntensity={0.15} />
                </instancedMesh>
                <instancedMesh ref={greenBoxRibbonRef} args={[undefined, undefined, greenBoxCount]}>
                    <primitive object={ribbonGeometry} attach="geometry" />
                    <meshStandardMaterial color="#FFD700" metalness={0.95} roughness={0.05} emissive="#332200" />
                </instancedMesh>
            </group>
            <instancedMesh ref={redSphereMeshRef} args={[undefined, undefined, 70]}>
                <sphereGeometry args={[1, 32, 32]} />
                <meshPhysicalMaterial color="#8A0303" metalness={0.8} roughness={0.3} clearcoat={1.0} bumpMap={glitterTexture} bumpScale={0.08} emissive="#220000" emissiveIntensity={0.2} />
            </instancedMesh>
            <instancedMesh ref={silverSphereMeshRef} args={[undefined, undefined, 70]}>
                <sphereGeometry args={[1, 32, 32]} />
                <meshPhysicalMaterial color="#F5F5F5" metalness={1.0} roughness={0.05} clearcoat={1.0} emissive="#111111" emissiveIntensity={0.1} />
            </instancedMesh>
            <instancedMesh ref={caneMeshRef} args={[undefined, undefined, caneCount]}>
                <primitive object={new THREE.TubeGeometry(caneCurve, 64, 0.25, 16, false)} attach="geometry" />
                <meshPhysicalMaterial map={caneTexture} roughness={0.1} metalness={0.2} clearcoat={1.0} />
            </instancedMesh>
            <instancedMesh ref={lightMeshRef} args={[undefined, undefined, lightCount]}>
                <sphereGeometry args={[1, 16, 16]} />
                <meshBasicMaterial toneMapped={false} />
            </instancedMesh>
        </group>
    );
};
