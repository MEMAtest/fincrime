"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Sphere } from "@react-three/drei";
import * as THREE from "three";

function RiskAlert() {
  const outerRingRef = useRef<THREE.Mesh>(null);
  const innerRingRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (outerRingRef.current) {
      outerRingRef.current.rotation.z = state.clock.elapsedTime * 0.5;
    }
    if (innerRingRef.current) {
      innerRingRef.current.rotation.z = -state.clock.elapsedTime * 0.7;
    }
    if (coreRef.current) {
      const pulse = Math.sin(state.clock.elapsedTime * 2) * 0.1 + 1;
      coreRef.current.scale.set(pulse, pulse, pulse);
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.4}>
      <group>
        {/* Outer ring */}
        <mesh ref={outerRingRef}>
          <torusGeometry args={[2.5, 0.15, 16, 100]} />
          <meshStandardMaterial
            color="#f97316"
            emissive="#f97316"
            emissiveIntensity={0.5}
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>

        {/* Inner ring */}
        <mesh ref={innerRingRef}>
          <torusGeometry args={[1.8, 0.1, 16, 100]} />
          <meshStandardMaterial
            color="#fb923c"
            emissive="#fb923c"
            emissiveIntensity={0.4}
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>

        {/* Pulsing distorted core */}
        <Sphere ref={coreRef} args={[1, 32, 32]}>
          <MeshDistortMaterial
            color="#ef4444"
            speed={2}
            distort={0.4}
            radius={1}
            emissive="#dc2626"
            emissiveIntensity={0.8}
            metalness={0.5}
            roughness={0.2}
          />
        </Sphere>

        {/* Indicator spikes */}
        {[0, 60, 120, 180, 240, 300].map((angle, i) => {
          const radian = (angle * Math.PI) / 180;
          const x = Math.cos(radian) * 2;
          const y = Math.sin(radian) * 2;
          return (
            <mesh key={i} position={[x, y, 0]} rotation={[0, 0, radian]}>
              <coneGeometry args={[0.15, 0.6, 8]} />
              <meshStandardMaterial
                color="#fbbf24"
                emissive="#f59e0b"
                emissiveIntensity={0.6}
              />
            </mesh>
          );
        })}

        {/* Floating alert particles */}
        <Sphere args={[0.1, 16, 16]} position={[3, 1, 0.5]}>
          <meshStandardMaterial color="#fca5a5" emissive="#ef4444" emissiveIntensity={0.8} />
        </Sphere>
        <Sphere args={[0.12, 16, 16]} position={[-2.5, -1.5, 1]}>
          <meshStandardMaterial color="#fdba74" emissive="#f97316" emissiveIntensity={0.7} />
        </Sphere>
        <Sphere args={[0.08, 16, 16]} position={[1, -2.5, -0.5]}>
          <meshStandardMaterial color="#fde047" emissive="#fbbf24" emissiveIntensity={0.6} />
        </Sphere>
      </group>
    </Float>
  );
}

export default function RiskGauge3D() {
  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
        <ambientLight intensity={0.3} />
        <spotLight position={[10, 10, 10]} angle={0.2} penumbra={1} intensity={1.5} color="#ff6b35" />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#fbbf24" />
        <RiskAlert />
      </Canvas>
    </div>
  );
}
