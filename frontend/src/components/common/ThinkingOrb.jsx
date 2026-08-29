import React, { useEffect, useRef } from 'react';

export default function ThinkingOrb({ label = "Thinking...", size = 32 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    // Generate 3D points on a sphere (Fibonacci Sphere Algorithm)
    const numPoints = 140;
    const points = [];
    const goldenRatio = (1 + Math.sqrt(5)) / 2;

    for (let i = 0; i < numPoints; i++) {
      const theta = (2 * Math.PI * i) / goldenRatio;
      const phi = Math.acos(1 - (2 * (i + 0.5)) / numPoints);
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.sin(phi) * Math.sin(theta);
      const z = Math.cos(phi);
      points.push({ x, y, z });
    }

    let angleX = 0;
    let angleY = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const sphereRadius = (canvas.width / 2) * 0.78;

      angleX += 0.015;
      angleY += 0.022;

      // Sort points by depth (Z-index) for proper 3D rendering
      const projected = points.map((p) => {
        // Rotate around Y-axis
        let x1 = p.x * Math.cos(angleY) + p.z * Math.sin(angleY);
        let z1 = -p.x * Math.sin(angleY) + p.z * Math.cos(angleY);

        // Rotate around X-axis
        let y2 = p.y * Math.cos(angleX) - z1 * Math.sin(angleX);
        let z2 = p.y * Math.sin(angleX) + z1 * Math.cos(angleX);

        return {
          px: centerX + x1 * sphereRadius,
          py: centerY + y2 * sphereRadius,
          pz: z2,
        };
      });

      projected.sort((a, b) => a.pz - b.pz);

      // Draw each point with depth-based brightness and scale
      projected.forEach((pt) => {
        const depth = (pt.pz + 1) / 2; // Normalize between 0 and 1
        const radius = 0.6 + depth * 1.1;
        const alpha = 0.15 + depth * 0.85;

        ctx.beginPath();
        ctx.arc(pt.px, pt.py, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(235, 235, 235, ${alpha})`;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="inline-flex items-center gap-3.5 bg-[#222222] border border-[#2e2e2e] px-4 py-2 rounded-full shadow-lg select-none">
      {/* 3D Rotating Dotted Orb */}
      <canvas
        ref={canvasRef}
        width={size * 2}
        height={size * 2}
        style={{ width: size, height: size }}
        className="shrink-0"
      />

      {/* Monospace Status Label */}
      <span className="font-mono text-sm tracking-wider text-neutral-200 font-medium">
        {label}
      </span>
    </div>
  );
}