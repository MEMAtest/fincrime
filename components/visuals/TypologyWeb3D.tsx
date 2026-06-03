"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";

type Vec3 = [number, number, number];

type Node = { pos: Vec3; color: string; r: number };
type Edge = { from: Vec3; to: Vec3; color: string };

// Build a branching transaction network: a central detection hub fed by
// three laundering "layers" (placement → layering → integration). Funds flow
// inward along the edges toward the hub, representing a detected typology.
function buildNetwork(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const center: Vec3 = [0, 0, 0];

  const layer1: Vec3[] = [];
  const layer2: Vec3[] = [];
  const layer3: Vec3[] = [];

  // Layer 1 — 3 relay nodes near the hub (emerald)
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const p: Vec3 = [Math.cos(a) * 1.7, Math.sin(a) * 1.7, Math.cos(a * 2) * 0.4];
    layer1.push(p);
    nodes.push({ pos: p, color: "#10b981", r: 0.16 });
    edges.push({ from: p, to: center, color: "#10b981" });
  }

  // Layer 2 — each relay branches into two (teal), one flagged amber
  layer1.forEach((parent, i) => {
    for (let k = 0; k < 2; k++) {
      const a = (i / 3) * Math.PI * 2 + 0.4 + (k === 0 ? -0.45 : 0.45);
      const p: Vec3 = [Math.cos(a) * 3.1, Math.sin(a) * 3.1, Math.cos(a * 3) * 0.6];
      const flagged = i === 1 && k === 0;
      layer2.push(p);
      nodes.push({ pos: p, color: flagged ? "#f59e0b" : "#14b8a6", r: flagged ? 0.18 : 0.13 });
      edges.push({ from: p, to: parent, color: flagged ? "#f59e0b" : "#14b8a6" });
    }
  });

  // Layer 3 — outer source accounts (blue), one flagged amber
  layer2.forEach((parent, j) => {
    const a = (j / layer2.length) * Math.PI * 2 + 0.2;
    const p: Vec3 = [Math.cos(a) * 4.5, Math.sin(a) * 4.5, Math.cos(a * 2) * 0.8];
    const flagged = j === 4;
    layer3.push(p);
    nodes.push({ pos: p, color: flagged ? "#f59e0b" : "#3b82f6", r: flagged ? 0.15 : 0.11 });
    edges.push({ from: p, to: parent, color: flagged ? "#f59e0b" : "#3b82f6" });
  });

  return { nodes, edges };
}

function NetworkNode({ pos, color, r }: Node) {
  const ref = useRef<THREE.Mesh>(null);
  // Stable per-node phase from position so pulses are varied but deterministic
  const phase = (pos[0] + pos[1]) * 1.7;

  useFrame((state) => {
    if (ref.current && ref.current.material instanceof THREE.MeshStandardMaterial) {
      ref.current.material.emissiveIntensity =
        1.4 + Math.sin(state.clock.elapsedTime * 2 + phase) * 0.5;
    }
  });

  return (
    <mesh ref={ref} position={pos}>
      <sphereGeometry args={[r, 20, 20]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} />
    </mesh>
  );
}

function Connection({ from, to, color }: Edge) {
  const distance = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const mid: Vec3 = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2];

  // Orient a cylinder (default +Y) along the edge direction
  const quaternion = useMemo(() => {
    const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]).normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  }, [from, to]);

  return (
    <mesh position={mid} quaternion={quaternion}>
      <cylinderGeometry args={[0.012, 0.012, distance, 6]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.5}
        transparent
        opacity={0.45}
      />
    </mesh>
  );
}

// Particles flowing inward along edges — money moving through the typology
function FlowParticles({ edges }: { edges: Edge[] }) {
  const groupRef = useRef<THREE.Group>(null);
  const count = 22;

  // Assign each particle an edge + speed + offset, deterministically
  const specs = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        edge: edges[i % edges.length],
        speed: 0.18 + ((i * 7) % 10) / 40,
        offset: ((i * 13) % 100) / 100,
        color: edges[i % edges.length].color,
      })),
    [edges]
  );

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, i) => {
      const { edge, speed, offset } = specs[i];
      const progress = (state.clock.elapsedTime * speed + offset) % 1;
      // flow from outer (from) toward hub (to)
      child.position.set(
        edge.from[0] + (edge.to[0] - edge.from[0]) * progress,
        edge.from[1] + (edge.to[1] - edge.from[1]) * progress,
        edge.from[2] + (edge.to[2] - edge.from[2]) * progress
      );
      const s = 0.6 + Math.sin(progress * Math.PI) * 0.8;
      child.scale.setScalar(s);
    });
  });

  return (
    <group ref={groupRef}>
      {specs.map((spec, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color={spec.color} emissive={spec.color} emissiveIntensity={2.2} />
        </mesh>
      ))}
    </group>
  );
}

// Central detection hub — rings + pulsing core where the pattern converges
function DetectionHub() {
  const ringARef = useRef<THREE.Mesh>(null);
  const ringBRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ringARef.current) ringARef.current.rotation.z = t * 0.4;
    if (ringBRef.current) ringBRef.current.rotation.z = -t * 0.55;
    if (coreRef.current) {
      const p = 1 + Math.sin(t * 2.2) * 0.12;
      coreRef.current.scale.set(p, p, p);
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.3}>
      <group>
        <mesh ref={ringARef}>
          <torusGeometry args={[0.95, 0.04, 16, 100]} />
          <meshStandardMaterial color="#34d399" emissive="#10b981" emissiveIntensity={0.9} metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh ref={ringBRef} rotation={[Math.PI / 2.4, 0, 0]}>
          <torusGeometry args={[0.7, 0.03, 16, 100]} />
          <meshStandardMaterial color="#2dd4bf" emissive="#14b8a6" emissiveIntensity={0.8} metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh ref={coreRef}>
          <sphereGeometry args={[0.42, 32, 32]} />
          <meshStandardMaterial color="#10b981" emissive="#059669" emissiveIntensity={1.4} metalness={0.4} roughness={0.25} />
        </mesh>
      </group>
    </Float>
  );
}

function TypologyScene() {
  const groupRef = useRef<THREE.Group>(null);
  const { nodes, edges } = useMemo(() => buildNetwork(), []);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.25) * 0.35;
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.18) * 0.08;
    }
  });

  return (
    <group ref={groupRef}>
      <DetectionHub />
      {edges.map((e, i) => (
        <Connection key={`edge-${i}`} {...e} />
      ))}
      {nodes.map((n, i) => (
        <NetworkNode key={`node-${i}`} {...n} />
      ))}
      <FlowParticles edges={edges} />
    </group>
  );
}

export default function TypologyWeb3D() {
  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [0, 0, 9], fov: 50 }}>
        <ambientLight intensity={0.3} />
        <spotLight position={[8, 8, 10]} angle={0.3} penumbra={1} intensity={1.6} color="#10b981" />
        <pointLight position={[-10, -8, -6]} intensity={0.5} color="#3b82f6" />
        <TypologyScene />
      </Canvas>
    </div>
  );
}
