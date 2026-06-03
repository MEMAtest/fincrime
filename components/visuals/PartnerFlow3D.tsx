"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";

function PaymentEcosystem() {
  const coreRef = useRef<THREE.Group>(null);
  const channelsRef = useRef<THREE.Group>(null);
  const transactionsRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (coreRef.current) {
      coreRef.current.rotation.y = state.clock.elapsedTime * 0.2;
    }
    if (channelsRef.current) {
      channelsRef.current.rotation.z = -state.clock.elapsedTime * 0.1;
    }
    if (transactionsRef.current) {
      transactionsRef.current.children.forEach((child, i) => {
        const progress = (state.clock.elapsedTime * 0.8 + i * 0.15) % 1;
        const angle = (i / transactionsRef.current!.children.length) * Math.PI * 2;
        const radius = 2 + progress * 3;
        child.position.x = Math.cos(angle) * radius;
        child.position.y = Math.sin(angle) * radius * 0.6;
        child.position.z = Math.sin(progress * Math.PI) * 0.5;
        const scale = 1 - Math.abs(progress - 0.5) * 0.6;
        child.scale.set(scale, scale, scale);
      });
    }
  });

  return (
    <group>
      {/* Central processing core */}
      <group ref={coreRef}>
        <Float speed={2} rotationIntensity={0.3} floatIntensity={0.4}>
          <mesh>
            <cylinderGeometry args={[0.8, 0.8, 0.6, 32]} />
            <meshStandardMaterial
              color="#06b6d4"
              emissive="#0891b2"
              emissiveIntensity={1.2}
              metalness={0.95}
              roughness={0.05}
            />
          </mesh>

          {[1, 1.2, 1.4].map((radius, i) => (
            <mesh key={i} rotation={[Math.PI / 2, 0, i * 0.4]}>
              <torusGeometry args={[radius, 0.045, 16, 100]} />
              <meshStandardMaterial
                color="#0ea5e9"
                emissive="#06b6d4"
                emissiveIntensity={0.8 - i * 0.15}
                transparent
                opacity={0.6 - i * 0.1}
              />
            </mesh>
          ))}

          {[...Array(6)].map((_, i) => {
            const angle = (i / 6) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(angle) * 0.9, 0, Math.sin(angle) * 0.9]}>
                <sphereGeometry args={[0.08, 16, 16]} />
                <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={2} />
              </mesh>
            );
          })}
        </Float>
      </group>

      {/* Transaction flow particles */}
      <group ref={transactionsRef}>
        {[...Array(24)].map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.1, 12, 12]} />
            <meshStandardMaterial color="#14b8a6" emissive="#0ea5e9" emissiveIntensity={1.8} />
          </mesh>
        ))}
      </group>

      {/* Partner channels */}
      <group ref={channelsRef}>
        {[...Array(8)].map((_, i) => {
          const angle = (i / 8) * Math.PI * 2;
          const radius = 5.5;
          const channelColors = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"];
          const color = channelColors[i % 4];

          return (
            <Float key={`channel-${i}`} speed={1.5 + i * 0.1} rotationIntensity={0.15} floatIntensity={0.25}>
              <group
                position={[
                  Math.cos(angle) * radius,
                  Math.sin(angle) * radius * 0.6,
                  Math.cos(angle * 2) * 0.5,
                ]}
              >
                <mesh>
                  <boxGeometry args={[0.7, 0.6, 0.25]} />
                  <meshPhysicalMaterial
                    color={color}
                    transparent
                    opacity={0.15}
                    transmission={0.92}
                    roughness={0.05}
                    metalness={0.1}
                    thickness={0.35}
                    clearcoat={1}
                  />
                </mesh>
                <mesh>
                  <boxGeometry args={[0.75, 0.65, 0.3]} />
                  <meshStandardMaterial color={color} wireframe opacity={0.6} transparent />
                </mesh>
                <mesh position={[0.3, 0.25, 0.13]}>
                  <sphereGeometry args={[0.06, 12, 12]} />
                  <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={1.8} />
                </mesh>
                <mesh
                  position={[-Math.cos(angle) * radius * 0.5, -Math.sin(angle) * radius * 0.3, 0]}
                  rotation={[0, 0, angle]}
                >
                  <cylinderGeometry args={[0.02, 0.02, radius * 0.8, 8]} />
                  <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={0.6}
                    transparent
                    opacity={0.4}
                  />
                </mesh>
              </group>
            </Float>
          );
        })}
      </group>

      {/* Safeguarding vault */}
      <Float speed={2} rotationIntensity={0.3} floatIntensity={0.4}>
        <group position={[-5, -2, 1]}>
          <mesh>
            <boxGeometry args={[1.5, 1.2, 0.8]} />
            <meshPhysicalMaterial
              color="#10b981"
              transparent
              opacity={0.2}
              transmission={0.9}
              roughness={0.05}
              metalness={0.3}
              thickness={0.5}
              clearcoat={1}
            />
          </mesh>
          <mesh position={[0, 0, 0.41]}>
            <circleGeometry args={[0.4, 32]} />
            <meshStandardMaterial color="#14b8a6" emissive="#10b981" emissiveIntensity={1} metalness={0.9} roughness={0.1} />
          </mesh>
          {[...Array(3)].map((_, i) => (
            <mesh key={i} position={[0, 0, 0.42]} rotation={[0, 0, i * 0.5]}>
              <ringGeometry args={[0.35 + i * 0.08, 0.38 + i * 0.08, 32]} />
              <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.8} />
            </mesh>
          ))}
          <mesh position={[0, 0.8, 0.41]}>
            <planeGeometry args={[1.2, 0.25]} />
            <meshBasicMaterial color="#10b981" opacity={0.5} transparent />
          </mesh>
        </group>
      </Float>

      {/* Fraud detection AI */}
      <Float speed={2.5} rotationIntensity={0.4} floatIntensity={0.5}>
        <group position={[5, 2, 1]}>
          <mesh>
            <sphereGeometry args={[0.5, 32, 32]} />
            <meshStandardMaterial color="#ef4444" emissive="#dc2626" emissiveIntensity={1} metalness={0.8} roughness={0.2} />
          </mesh>
          {[...Array(8)].map((_, i) => {
            const angle = (i / 8) * Math.PI * 2;
            const radius = 0.8;
            return (
              <group key={i}>
                <mesh position={[Math.cos(angle) * radius, Math.sin(angle) * radius, 0]}>
                  <octahedronGeometry args={[0.1]} />
                  <meshStandardMaterial color="#f87171" emissive="#ef4444" emissiveIntensity={1.2} />
                </mesh>
                <mesh
                  position={[Math.cos(angle) * radius * 0.5, Math.sin(angle) * radius * 0.5, 0]}
                  rotation={[0, 0, angle]}
                >
                  <cylinderGeometry args={[0.01, 0.01, radius, 8]} />
                  <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.5} />
                </mesh>
              </group>
            );
          })}
          {[...Array(3)].map((_, i) => (
            <mesh key={`alert-${i}`} position={[-0.7 + i * 0.7, 1, 0]}>
              <sphereGeometry args={[0.06, 12, 12]} />
              <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={2} />
            </mesh>
          ))}
        </group>
      </Float>

      {/* RACI / SCA framework panel */}
      <Float speed={2} rotationIntensity={0.3} floatIntensity={0.4}>
        <group position={[0, 3.5, 1]}>
          <mesh>
            <planeGeometry args={[2.5, 1.2]} />
            <meshStandardMaterial color="#1e293b" emissive="#3b82f6" emissiveIntensity={0.15} metalness={0.8} roughness={0.2} />
          </mesh>
          {[...Array(3)].map((_, i) => (
            <group key={i} position={[-0.8 + i * 0.8, 0, 0.01]}>
              <mesh>
                <planeGeometry args={[0.5, 0.7]} />
                <meshStandardMaterial color="#3b82f6" emissive="#2563eb" emissiveIntensity={0.5} transparent opacity={0.8} />
              </mesh>
              <mesh position={[0, 0.3, 0.01]}>
                <sphereGeometry args={[0.05, 12, 12]} />
                <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={2} />
              </mesh>
            </group>
          ))}
        </group>
      </Float>

      {/* Reconciliation dashboard */}
      <Float speed={2.5} rotationIntensity={0.4} floatIntensity={0.5}>
        <group position={[-5, 2.5, 1]}>
          <mesh>
            <planeGeometry args={[2, 1.5]} />
            <meshStandardMaterial color="#1e293b" emissive="#10b981" emissiveIntensity={0.15} metalness={0.8} roughness={0.2} />
          </mesh>
          {[...Array(7)].map((_, i) => (
            <mesh key={i} position={[-0.7 + i * 0.25, -0.3, 0.01]}>
              <planeGeometry args={[0.15, 0.4 + ((i * 37) % 30) / 100]} />
              <meshBasicMaterial color="#10b981" opacity={0.6} transparent />
            </mesh>
          ))}
          <mesh position={[0, 0.5, 0.01]}>
            <planeGeometry args={[1.5, 0.2]} />
            <meshBasicMaterial color="#14b8a6" opacity={0.5} transparent />
          </mesh>
          {[...Array(3)].map((_, i) => (
            <mesh key={`match-${i}`} position={[-0.5 + i * 0.5, 0.5, 0.02]}>
              <sphereGeometry args={[0.04, 12, 12]} />
              <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={2} />
            </mesh>
          ))}
        </group>
      </Float>

      {/* API gateway constellation */}
      {[...Array(12)].map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const radius = 4;
        const height = Math.sin(angle * 2) * 1.5;
        return (
          <Float key={`api-${i}`} speed={1.5 + i * 0.1} rotationIntensity={0.15} floatIntensity={0.25}>
            <mesh position={[Math.cos(angle) * radius, height, Math.sin(angle) * radius * 0.5]}>
              <dodecahedronGeometry args={[0.18]} />
              <meshPhysicalMaterial color="#06b6d4" transparent opacity={0.2} transmission={0.9} roughness={0.1} metalness={0.3} thickness={0.3} clearcoat={1} />
            </mesh>
          </Float>
        );
      })}

      {/* Sanctions screening nodes */}
      {[...Array(6)].map((_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        const radius = 7;
        return (
          <Float key={`sanction-${i}`} speed={2 + i * 0.15} rotationIntensity={0.2} floatIntensity={0.3}>
            <group position={[Math.cos(angle) * radius, Math.sin(angle) * radius * 0.4, 0]}>
              <mesh>
                <octahedronGeometry args={[0.2]} />
                <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={1} transparent opacity={0.8} />
              </mesh>
            </group>
          </Float>
        );
      })}

      {/* Payment rails */}
      {[...Array(4)].map((_, i) => {
        const angle = (i / 4) * Math.PI * 2;
        const radius = 6.5;
        return (
          <Float key={`rail-${i}`} speed={1.5 + i * 0.2} rotationIntensity={0.1} floatIntensity={0.2}>
            <group position={[Math.cos(angle) * radius, Math.sin(angle) * radius * 0.5, 0]}>
              <mesh>
                <cylinderGeometry args={[0.2, 0.2, 0.6, 16]} />
                <meshStandardMaterial color="#8b5cf6" emissive="#7c3aed" emissiveIntensity={0.8} metalness={0.7} roughness={0.3} />
              </mesh>
              <mesh
                position={[-Math.cos(angle) * radius * 0.5, -Math.sin(angle) * radius * 0.25, 0]}
                rotation={[0, 0, angle]}
              >
                <cylinderGeometry args={[0.025, 0.025, radius * 0.7, 8]} />
                <meshStandardMaterial color="#a855f7" emissive="#8b5cf6" emissiveIntensity={0.4} transparent opacity={0.3} />
              </mesh>
            </group>
          </Float>
        );
      })}

      {/* Settlement status rings */}
      {[...Array(3)].map((_, i) => {
        const radius = 3 + i * 0.4;
        return (
          <mesh key={`settle-${i}`} rotation={[Math.PI / 2, 0, i * 0.25]}>
            <torusGeometry args={[radius, 0.03, 16, 100]} />
            <meshStandardMaterial color="#10b981" emissive="#059669" emissiveIntensity={0.4 - i * 0.1} transparent opacity={0.3 - i * 0.06} />
          </mesh>
        );
      })}

      {/* Real-time monitoring streams */}
      {[...Array(30)].map((_, i) => {
        const angle = (i / 30) * Math.PI * 2;
        const radius = 1.5 + ((i * 53) % 100) / 50;
        const height = (((i * 29) % 100) / 100 - 0.5) * 4;
        return (
          <mesh key={`monitor-${i}`} position={[Math.cos(angle) * radius, height, Math.sin(angle) * radius * 0.5]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshStandardMaterial color="#14b8a6" emissive="#0ea5e9" emissiveIntensity={1.2} transparent opacity={0.8} />
          </mesh>
        );
      })}

      {/* E-money issuance indicator */}
      <Float speed={2} rotationIntensity={0.3} floatIntensity={0.4}>
        <group position={[5, -2.5, 1]}>
          <mesh>
            <planeGeometry args={[1.5, 1]} />
            <meshStandardMaterial color="#1e293b" emissive="#06b6d4" emissiveIntensity={0.15} metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.3, 0.01]}>
            <planeGeometry args={[1.2, 0.2]} />
            <meshBasicMaterial color="#0ea5e9" opacity={0.6} transparent />
          </mesh>
          {[...Array(4)].map((_, i) => (
            <mesh key={i} position={[-0.5 + i * 0.35, -0.2, 0.01]}>
              <sphereGeometry args={[0.04, 12, 12]} />
              <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={2} />
            </mesh>
          ))}
        </group>
      </Float>
    </group>
  );
}

export default function PartnerFlow3D() {
  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [0, 0, 14], fov: 50 }} shadows>
        <ambientLight intensity={0.3} />
        <spotLight position={[14, 14, 14]} angle={0.3} penumbra={1} intensity={2} castShadow color="#06b6d4" />
        <pointLight position={[-14, -14, -12]} intensity={0.8} color="#14b8a6" />
        <PaymentEcosystem />
      </Canvas>
    </div>
  );
}
