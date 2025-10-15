"use client";
import { useEffect, useRef } from "react";
import { Leaf, Sparkles } from "lucide-react";

export default function GlobeHero() {
  const starsRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const createStars = () => {
      const starsContainer = starsRef.current;
      if (!starsContainer) return;
      
      // Clear existing stars
      starsContainer.innerHTML = '';
      
      // Create subtle star field
      for (let i = 0; i < 50; i++) {
        const star = document.createElement('div');
        star.className = 'absolute rounded-full bg-white opacity-20';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.width = Math.random() * 2 + 1 + 'px';
        star.style.height = star.style.width;
        star.style.animationDelay = Math.random() * 3 + 's';
        star.style.animation = 'pulse 3s infinite';
        starsContainer.appendChild(star);
      }
    };
    
    createStars();
  }, []);

  return (
    <div className="relative h-[60vh] w-full overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50"></div>
      
      {/* Subtle grain texture */}
      <div className="absolute inset-0 opacity-[0.015]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
      }}></div>
      
      {/* Floating particles */}
      <div ref={starsRef} className="absolute inset-0"></div>
      
      {/* Radial gradient overlay */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-green-100/20"></div>
      
      {/* Content */}
      <div className="relative z-10 flex h-full items-center justify-center px-6">
        <div className="text-center">
          {/* What's New Chip */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/80 backdrop-blur-sm px-4 py-2 text-sm font-medium text-green-700 shadow-sm border border-green-200">
            <Sparkles size={14} />
            New: PDF Translation Tool
          </div>
          
          {/* Icon */}
          <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 backdrop-blur-sm border border-green-200/50">
            <Leaf className="h-10 w-10 text-green-600" />
          </div>
          
          {/* Headline */}
          <h1 className="mb-4 text-5xl font-bold leading-tight text-slate-900 md:text-7xl">
            ESG Portal
          </h1>
          <p className="mx-auto max-w-2xl text-xl leading-relaxed text-slate-600">
            Environmental, Social, and Governance insights for sustainable investing
          </p>
        </div>
      </div>
      
      {/* Subtle parallax dots */}
      <div className="absolute inset-0 opacity-5">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute h-1 w-1 rounded-full bg-green-600"
            style={{
              left: Math.random() * 100 + '%',
              top: Math.random() * 100 + '%',
              animationDelay: `${i * 0.1}s`,
              animation: `float 6s infinite ease-in-out`,
            }}
          />
        ))}
      </div>
    </div>
  );
}