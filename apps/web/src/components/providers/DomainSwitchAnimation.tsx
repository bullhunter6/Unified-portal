"use client";
import { createContext, useContext, useState, useEffect } from "react";

type DomainSwitchContextType = {
  triggerAnimation: (targetDomain: "esg" | "credit") => void;
};

const DomainSwitchContext = createContext<DomainSwitchContextType | null>(null);

export function useDomainSwitch() {
  const ctx = useContext(DomainSwitchContext);
  if (!ctx) throw new Error("useDomainSwitch must be used within DomainSwitchProvider");
  return ctx;
}

export function DomainSwitchProvider({ children }: { children: React.ReactNode }) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [targetDomain, setTargetDomain] = useState<"esg" | "credit" | null>(null);

  const triggerAnimation = (domain: "esg" | "credit") => {
    setTargetDomain(domain);
    setIsAnimating(true);
    
    // Animation duration - it will auto-hide after
    setTimeout(() => {
      setIsAnimating(false);
      setTargetDomain(null);
    }, 2800);
  };

  useEffect(() => {
    if (isAnimating) {
      // Prevent scrolling during animation
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }, [isAnimating]);

  return (
    <DomainSwitchContext.Provider value={{ triggerAnimation }}>
      {children}
      {isAnimating && targetDomain && <DomainSwitchAnimation domain={targetDomain} />}
    </DomainSwitchContext.Provider>
  );
}

function DomainSwitchAnimation({ domain }: { domain: "esg" | "credit" }) {
  const isESG = domain === "esg";
  const primaryColor = isESG ? "rgb(16, 185, 129)" : "rgb(59, 130, 246)";
  const secondaryColor = isESG ? "rgb(34, 197, 94)" : "rgb(147, 51, 234)";
  const accentColor = isESG ? "rgb(5, 150, 105)" : "rgb(99, 102, 241)";

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden">
      {/* Smooth gradient background with wave effect */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(120deg, ${primaryColor}15 0%, ${secondaryColor}20 50%, ${primaryColor}15 100%)`,
          animation: "fade-in-out 2.8s ease-in-out forwards",
        }}
      />

      {/* Liquid morphing blob effect */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            width: "40vw",
            height: "40vw",
            background: `radial-gradient(circle, ${primaryColor}40 0%, transparent 70%)`,
            animation: "liquid-morph-1 2.5s cubic-bezier(0.4, 0, 0.2, 1) forwards",
          }}
        />
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            width: "35vw",
            height: "35vw",
            background: `radial-gradient(circle, ${secondaryColor}50 0%, transparent 70%)`,
            animation: "liquid-morph-2 2.5s cubic-bezier(0.4, 0, 0.2, 1) 0.15s forwards",
          }}
        />
        <div
          className="absolute rounded-full blur-2xl"
          style={{
            width: "30vw",
            height: "30vw",
            background: `radial-gradient(circle, ${accentColor}30 0%, transparent 70%)`,
            animation: "liquid-morph-3 2.5s cubic-bezier(0.4, 0, 0.2, 1) 0.3s forwards",
          }}
        />
      </div>

      {/* Floating particles with smooth motion */}
      <div className="absolute inset-0">
        {[...Array(30)].map((_, i) => {
          const startX = Math.random() * 100;
          const startY = Math.random() * 100;
          const endX = Math.random() * 100;
          const endY = Math.random() * 100;
          const size = Math.random() * 8 + 4;
          const duration = Math.random() * 2 + 1.5;
          const delay = Math.random() * 0.5;
          
          return (
            <div
              key={`particle-${i}`}
              className="absolute rounded-full"
              style={{
                left: `${startX}%`,
                top: `${startY}%`,
                width: `${size}px`,
                height: `${size}px`,
                background: [primaryColor, secondaryColor, accentColor][i % 3],
                boxShadow: `0 0 ${size * 3}px ${[primaryColor, secondaryColor, accentColor][i % 3]}`,
                opacity: 0,
                animation: `float-particle ${duration}s ease-in-out ${delay}s forwards`,
                "--end-x": `${endX}%`,
                "--end-y": `${endY}%`,
              } as any}
            />
          );
        })}
      </div>

      {/* Elegant wave lines */}
      <svg className="absolute inset-0 w-full h-full opacity-20">
        <defs>
          <linearGradient id="wave-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={primaryColor} stopOpacity="0" />
            <stop offset="50%" stopColor={secondaryColor} stopOpacity="1" />
            <stop offset="100%" stopColor={primaryColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => (
          <path
            key={`wave-${i}`}
            d={`M 0 ${50 + i * 15} Q 50 ${40 + i * 15} 100 ${50 + i * 15} T 200 ${50 + i * 15}`}
            stroke="url(#wave-gradient)"
            strokeWidth="2"
            fill="none"
            style={{
              animation: `wave-flow 2.5s ease-in-out ${i * 0.1}s infinite`,
              vectorEffect: "non-scaling-stroke",
            }}
          />
        ))}
      </svg>

      {/* Smooth rotating ring */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="absolute rounded-full"
          style={{
            width: "60vmin",
            height: "60vmin",
            border: `2px solid ${primaryColor}`,
            opacity: 0.3,
            animation: "rotate-ring 2.5s cubic-bezier(0.4, 0, 0.2, 1) forwards",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: "50vmin",
            height: "50vmin",
            border: `2px solid ${secondaryColor}`,
            opacity: 0.4,
            animation: "rotate-ring 2.5s cubic-bezier(0.4, 0, 0.2, 1) 0.1s forwards reverse",
          }}
        />
      </div>

      {/* Beautiful text reveal with smooth transitions */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          {/* Icon/Logo */}
          <div
            style={{
              animation: "icon-reveal 1.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
              opacity: 0,
            }}
          >
            <div
              className="inline-flex items-center justify-center w-24 h-24 rounded-full mb-6"
              style={{
                background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                boxShadow: `0 20px 60px ${primaryColor}60`,
              }}
            >
              {isESG ? (
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              )}
            </div>
          </div>

          {/* Main text */}
          <div
            className="text-7xl md:text-8xl font-black mb-3"
            style={{
              background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              animation: "text-reveal 1.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s forwards",
              opacity: 0,
              textShadow: `0 10px 40px ${primaryColor}40`,
            }}
          >
            {isESG ? "ESG" : "CREDIT"}
          </div>

          {/* Subtitle */}
          <div
            className="text-2xl font-semibold tracking-widest uppercase"
            style={{
              color: secondaryColor,
              animation: "subtitle-reveal 1.2s ease-out 1s forwards",
              opacity: 0,
            }}
          >
            Portal
          </div>

          {/* Animated underline */}
          <div
            className="mx-auto mt-4 h-1 rounded-full"
            style={{
              width: "0%",
              background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})`,
              animation: "underline-expand 1.2s ease-out 1.2s forwards",
            }}
          />
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in-out {
          0% {
            opacity: 0;
          }
          25% {
            opacity: 1;
          }
          75% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }

        @keyframes liquid-morph-1 {
          0% {
            transform: scale(0) translate(0, 0);
            opacity: 0;
            border-radius: 50%;
          }
          40% {
            opacity: 1;
            border-radius: 45% 55% 60% 40% / 55% 45% 55% 45%;
          }
          70% {
            border-radius: 55% 45% 40% 60% / 45% 55% 45% 55%;
          }
          100% {
            transform: scale(2.5) translate(20vw, -10vh);
            opacity: 0;
            border-radius: 50%;
          }
        }

        @keyframes liquid-morph-2 {
          0% {
            transform: scale(0) translate(0, 0);
            opacity: 0;
            border-radius: 50%;
          }
          40% {
            opacity: 1;
            border-radius: 40% 60% 55% 45% / 60% 50% 50% 40%;
          }
          70% {
            border-radius: 60% 40% 45% 55% / 50% 60% 40% 50%;
          }
          100% {
            transform: scale(2.5) translate(-20vw, 10vh);
            opacity: 0;
            border-radius: 50%;
          }
        }

        @keyframes liquid-morph-3 {
          0% {
            transform: scale(0);
            opacity: 0;
            border-radius: 50%;
          }
          40% {
            opacity: 1;
            border-radius: 50% 50% 45% 55% / 55% 45% 55% 45%;
          }
          100% {
            transform: scale(3);
            opacity: 0;
            border-radius: 50%;
          }
        }

        @keyframes float-particle {
          0% {
            opacity: 0;
            transform: translate(0, 0) scale(0);
          }
          20% {
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(
              calc(var(--end-x) - 50vw),
              calc(var(--end-y) - 50vh)
            ) scale(1.5);
          }
        }

        @keyframes wave-flow {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        @keyframes rotate-ring {
          0% {
            transform: scale(0) rotate(0deg);
            opacity: 0;
          }
          40% {
            opacity: 0.5;
          }
          100% {
            transform: scale(1.5) rotate(180deg);
            opacity: 0;
          }
        }

        @keyframes icon-reveal {
          0% {
            opacity: 0;
            transform: scale(0) rotate(-180deg);
          }
          70% {
            transform: scale(1.1) rotate(10deg);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
        }

        @keyframes text-reveal {
          0% {
            opacity: 0;
            transform: translateY(50px) scale(0.8);
            filter: blur(10px);
          }
          70% {
            transform: translateY(-5px) scale(1.05);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }

        @keyframes subtitle-reveal {
          0% {
            opacity: 0;
            transform: translateY(20px);
            letter-spacing: -0.1em;
          }
          100% {
            opacity: 1;
            transform: translateY(0);
            letter-spacing: 0.2em;
          }
        }

        @keyframes underline-expand {
          0% {
            width: 0%;
          }
          100% {
            width: 200px;
          }
        }
      `}</style>
    </div>
  );
}
