"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

function Document({
  position,
  rotation,
  delay = 0,
  color,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  delay?: number;
  color: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y =
        position[1] + Math.sin(state.clock.elapsedTime + delay) * 0.1;
    }
  });

  return (
    <mesh ref={meshRef} position={position} rotation={rotation || [0, 0, 0]}>
      <boxGeometry args={[1.2, 1.6, 0.05]} />
      <meshStandardMaterial color={color} metalness={0.3} roughness={0.4} />
      {[0.4, 0.1, -0.2, -0.5].map((y, i) => (
        <mesh key={i} position={[0, y, 0.03]}>
          <boxGeometry args={[0.8, 0.08, 0.01]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
      ))}
    </mesh>
  );
}

function Checkmark({ position }: { position: [number, number, number] }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 2) * 0.1);
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh>
        <circleGeometry args={[0.35, 32]} />
        <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[-0.08, 0, 0.01]} rotation={[0, 0, -0.3]}>
        <boxGeometry args={[0.15, 0.06, 0.02]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0.08, 0.08, 0.01]} rotation={[0, 0, 0.8]}>
        <boxGeometry args={[0.25, 0.06, 0.02]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

function FCABadge() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.2;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
      <group ref={groupRef} position={[0, 1.5, 0]}>
        <mesh>
          <cylinderGeometry args={[0.6, 0.4, 0.15, 6]} />
          <meshStandardMaterial color="#3b82f6" metalness={0.6} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0, 0.1]}>
          <boxGeometry args={[0.4, 0.15, 0.02]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      </group>
    </Float>
  );
}

function Scene() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      <Document position={[-0.8, -0.3, 0.3]} rotation={[0.1, 0.3, -0.05]} delay={0} color="#1e293b" />
      <Document position={[-0.4, 0, 0.15]} rotation={[0.05, 0.2, 0.02]} delay={0.5} color="#334155" />
      <Document position={[0, 0.3, 0]} rotation={[0, 0.1, 0]} delay={1} color="#475569" />

      <Checkmark position={[0.7, 0.5, 0.3]} />
      <Checkmark position={[0.9, -0.1, 0.2]} />
      <Checkmark position={[0.5, -0.6, 0.25]} />

      <FCABadge />

      <Float speed={3} floatIntensity={0.3}>
        <mesh position={[-1.2, 0.8, 0]}>
          <sphereGeometry args={[0.15, 32, 32]} />
          <MeshDistortMaterial
            color="#10b981"
            emissive="#10b981"
            emissiveIntensity={0.8}
            distort={0.3}
            speed={2}
          />
        </mesh>
      </Float>
    </group>
  );
}

export default function ControlsPack3D() {
  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <pointLight position={[-5, -5, -5]} intensity={0.5} color="#3b82f6" />
        <pointLight position={[5, 2, 2]} intensity={0.5} color="#10b981" />
        <Scene />
      </Canvas>
    </div>
  );
}
