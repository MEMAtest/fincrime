"use client";

import { useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Html } from "@react-three/drei";
import * as THREE from "three";

// Static connecting node with gentle pulse
function ConnectionNode({
  position,
  color,
}: {
  position: [number, number, number];
  color: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (
      meshRef.current &&
      meshRef.current.material instanceof THREE.MeshStandardMaterial
    ) {
      meshRef.current.material.emissiveIntensity =
        1.5 + Math.sin(state.clock.elapsedTime * 2) * 0.5;
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.08, 16, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={1.5}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

// Pulsing connection line
function PulsingConnection({
  start,
  end,
  color,
}: {
  start: [number, number, number];
  end: [number, number, number];
  color: string;
}) {
  const lineRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (
      lineRef.current &&
      lineRef.current.material instanceof THREE.MeshStandardMaterial
    ) {
      lineRef.current.material.emissiveIntensity =
        0.3 + Math.sin(state.clock.elapsedTime * 2) * 0.2;
    }
  });

  const distance = Math.sqrt(
    Math.pow(end[0] - start[0], 2) +
      Math.pow(end[1] - start[1], 2) +
      Math.pow(end[2] - start[2], 2)
  );

  const midPoint = [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2,
  ] as [number, number, number];

  return (
    <mesh ref={lineRef} position={midPoint}>
      <cylinderGeometry args={[0.02, 0.02, distance, 8]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.3}
        transparent
        opacity={0.4}
      />
    </mesh>
  );
}

// Interactive glass module with thematic icon
function InteractiveModule({
  position,
  color,
  label,
  size,
  icon,
  description,
}: {
  position: [number, number, number];
  color: string;
  label: string;
  size: [number, number, number];
  icon: string;
  description: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [clicked, setClicked] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (meshRef.current) {
      const scale = hovered ? 1.1 : 1.0;
      meshRef.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.1);
      if (clicked) {
        meshRef.current.rotation.y += 0.01;
      }
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.3}>
      <group position={position}>
        {/* Main glass module */}
        <mesh
          ref={meshRef}
          castShadow
          receiveShadow
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
          onClick={() => setClicked(!clicked)}
        >
          <boxGeometry args={size} />
          <meshPhysicalMaterial
            color={color}
            transparent
            opacity={hovered ? 0.3 : 0.2}
            transmission={0.95}
            roughness={0.05}
            metalness={0.1}
            thickness={0.5}
            envMapIntensity={1.5}
            clearcoat={1}
            clearcoatRoughness={0.1}
          />
        </mesh>

        {/* Wireframe frame */}
        <mesh>
          <boxGeometry args={[size[0] + 0.05, size[1] + 0.05, size[2] + 0.05]} />
          <meshBasicMaterial
            color={color}
            wireframe
            opacity={hovered ? 0.8 : 0.6}
            transparent
          />
        </mesh>

        {/* Glowing core */}
        <mesh position={[0, 0, 0.2]}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={hovered ? 2.5 : 1.5}
          />
        </mesh>

        {/* Thematic icon representation */}
        {icon === "shield" && (
          <mesh position={[0, 0, 0.4]}>
            <coneGeometry args={[0.2, 0.4, 4]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={1}
              transparent
              opacity={0.6}
            />
          </mesh>
        )}

        {icon === "network" && (
          <>
            {[...Array(4)].map((_, i) => (
              <mesh
                key={i}
                position={[
                  Math.cos((i * Math.PI) / 2) * 0.15,
                  Math.sin((i * Math.PI) / 2) * 0.15,
                  0.4,
                ]}
              >
                <sphereGeometry args={[0.04, 8, 8]} />
                <meshStandardMaterial
                  color={color}
                  emissive={color}
                  emissiveIntensity={1.5}
                />
              </mesh>
            ))}
          </>
        )}

        {icon === "data" && (
          <>
            {[0.18, 0, -0.18].map((y, i) => (
              <mesh key={i} position={[0, y, 0.4]}>
                <boxGeometry args={[0.42, 0.08, 0.04]} />
                <meshStandardMaterial
                  color={color}
                  emissive={color}
                  emissiveIntensity={1.2}
                />
              </mesh>
            ))}
          </>
        )}

        {icon === "docs" && (
          <mesh position={[0, 0, 0.4]} rotation={[0, 0, 0.08]}>
            <boxGeometry args={[0.34, 0.46, 0.03]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={1}
              transparent
              opacity={0.75}
            />
          </mesh>
        )}

        {/* Data stream particles */}
        {[...Array(3)].map((_, j) => (
          <mesh key={j} position={[0, 0, 0.4 + j * 0.1]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={2}
            />
          </mesh>
        ))}

        {/* Hover tooltip */}
        {hovered && (
          <Html distanceFactor={10} position={[0, 1, 0]} style={{ pointerEvents: "none" }}>
            <div className="bg-slate-900/95 backdrop-blur-sm border border-emerald-500/50 rounded-lg p-3 shadow-xl min-w-[200px] -translate-x-1/2">
              <h3 className="text-emerald-400 font-bold mb-1">{label}</h3>
              <p className="text-slate-300 text-sm">{description}</p>
            </div>
          </Html>
        )}
      </group>
    </Float>
  );
}

// Smooth auto-rotating scene
function EcosystemScene() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.2;
    }
  });

  const modules = [
    {
      position: [-2, 2, 0] as [number, number, number],
      color: "#10b981",
      label: "Typologies",
      size: [1.8, 1.5, 0.3] as [number, number, number],
      icon: "network",
      description: "FATF & Wolfsberg-sourced AML typologies",
    },
    {
      position: [2, 2, 0] as [number, number, number],
      color: "#3b82f6",
      label: "Risk Themes",
      size: [1.8, 1.5, 0.3] as [number, number, number],
      icon: "shield",
      description: "Mapped risk themes & inherent risk scoring",
    },
    {
      position: [-2, -0.5, 0] as [number, number, number],
      color: "#f59e0b",
      label: "Detection",
      size: [1.8, 1.5, 0.3] as [number, number, number],
      icon: "data",
      description: "Detection logic, rules & data requirements",
    },
    {
      position: [2, -0.5, 0] as [number, number, number],
      color: "#8b5cf6",
      label: "Controls",
      size: [1.8, 1.5, 0.3] as [number, number, number],
      icon: "docs",
      description: "Governance, workflows & control ownership",
    },
  ];

  const centerPos: [number, number, number] = [0, 0.75, 0];

  return (
    <group ref={groupRef}>
      {/* Central hub torus */}
      <Float speed={2} rotationIntensity={0.3} floatIntensity={0.5}>
        <mesh position={centerPos}>
          <torusGeometry args={[1.2, 0.15, 16, 100]} />
          <meshStandardMaterial
            color="#10b981"
            emissive="#059669"
            emissiveIntensity={0.8}
            metalness={0.9}
            roughness={0.1}
            transparent
            opacity={0.95}
          />
        </mesh>
      </Float>

      {modules.map((module, i) => (
        <InteractiveModule key={i} {...module} />
      ))}

      {modules.map((module, i) => (
        <PulsingConnection
          key={`conn-${i}`}
          start={centerPos}
          end={module.position}
          color={module.color}
        />
      ))}

      {modules.map((module, i) => {
        const nodeCount = 3;
        const nodes = [];
        for (let j = 1; j <= nodeCount; j++) {
          const t = j / (nodeCount + 1);
          const position: [number, number, number] = [
            centerPos[0] + (module.position[0] - centerPos[0]) * t,
            centerPos[1] + (module.position[1] - centerPos[1]) * t,
            centerPos[2] + (module.position[2] - centerPos[2]) * t,
          ];
          nodes.push(
            <ConnectionNode key={`node-${i}-${j}`} position={position} color={module.color} />
          );
        }
        return <group key={`nodes-${i}`}>{nodes}</group>;
      })}

      {/* Ambient particles */}
      {[...Array(20)].map((_, i) => {
        const angle = (i / 20) * Math.PI * 2;
        const radius = 3 + (i % 5) * 0.2;
        return (
          <mesh
            key={`ambient-${i}`}
            position={[
              Math.cos(angle) * radius,
              Math.sin(angle) * radius,
              ((i % 4) - 1.5) * 0.6,
            ]}
          >
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial
              color="#10b981"
              emissive="#10b981"
              emissiveIntensity={0.8}
              transparent
              opacity={0.6}
            />
          </mesh>
        );
      })}
    </group>
  );
}

export default function ControlEcosystem3D() {
  useEffect(() => {
    // Suppress noisy THREE geometry warning from degenerate hover scaling
    const originalError = console.error;
    console.error = (...args) => {
      if (args[0]?.includes?.("THREE.BufferGeometry.computeBoundingSphere")) {
        return;
      }
      originalError.call(console, ...args);
    };
    return () => {
      console.error = originalError;
    };
  }, []);

  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [0, 0, 8], fov: 50 }} shadows>
        <ambientLight intensity={0.25} />
        <spotLight
          position={[10, 10, 10]}
          angle={0.3}
          penumbra={1}
          intensity={2}
          castShadow
          color="#10b981"
        />
        <pointLight position={[-10, -10, -5]} intensity={0.5} color="#3b82f6" />
        <EcosystemScene />
      </Canvas>
    </div>
  );
}
