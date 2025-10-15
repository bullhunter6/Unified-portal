"use client";
import { useEffect, useRef } from "react";

export function FloatingDots({
  className, count = 120, minSpeed = 0.15, maxSpeed = 0.6, maxRadius = 1.2,
}: { className?: string; count?: number; minSpeed?: number; maxSpeed?: number; maxRadius?: number; }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let w = (canvas.width = canvas.offsetWidth);
    let h = (canvas.height = canvas.offsetHeight);

    const dots = Array.from({ length: count }).map(() => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * (maxRadius * 2) + 0.5,
      vx: (Math.random() * (maxSpeed - minSpeed) + minSpeed) * (Math.random() < 0.5 ? -1 : 1),
      vy: (Math.random() * (maxSpeed - minSpeed) + minSpeed) * (Math.random() < 0.5 ? -1 : 1),
    }));

    const onResize = () => { w = canvas.width = canvas.offsetWidth; h = canvas.height = canvas.offsetHeight; };
    const ro = new ResizeObserver(onResize); ro.observe(canvas);

    let id = 0;
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = 0.75;
      for (const d of dots) {
        d.x += d.vx; d.y += d.vy;
        if (d.x < 0 || d.x > w) d.vx *= -1;
        if (d.y < 0 || d.y > h) d.vy *= -1;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.14)"; ctx.fill();
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(id); ro.disconnect(); };
  }, [count, minSpeed, maxSpeed, maxRadius]);

  return <canvas ref={ref} className={className ?? "absolute inset-0 h-full w-full"} />;
}