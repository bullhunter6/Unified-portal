"use client";
import { motion } from "framer-motion";
import { TrendingUp, Sparkles, BarChart3 } from "lucide-react";

export default function CreditHero() {
  return (
    <div className="relative h-[60vh] w-full overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/5">
      
      {/* Animated floating elements */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-2xl bg-primary/5 backdrop-blur-sm border border-primary/10"
            style={{
              left: `${10 + i * 15}%`,
              top: `${20 + (i % 3) * 20}%`,
              width: `${60 + i * 10}px`,
              height: `${40 + i * 8}px`,
            }}
            animate={{
              y: [0, -20, 0],
              rotate: [0, 5, -5, 0],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 4 + i,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.5,
            }}
          />
        ))}
      </div>
      
      {/* Main content */}
      <div className="relative z-10 flex h-full items-center justify-center px-6">
        <div className="text-center max-w-4xl mx-auto">
          
          {/* What's New Badge */}
          <motion.div 
            className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-2 text-sm font-medium text-primary"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Sparkles className="h-4 w-4" />
            New: Advanced Credit Analytics
          </motion.div>
          
          {/* Main Icon */}
          <motion.div 
            className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <TrendingUp className="h-10 w-10 text-primary" />
          </motion.div>
          
          {/* Title */}
          <motion.h1 
            className="mb-4 text-5xl font-bold leading-tight text-foreground md:text-6xl lg:text-7xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            Credit Portal
          </motion.h1>
          
          {/* Subtitle */}
          <motion.p 
            className="mx-auto max-w-2xl text-xl leading-relaxed text-muted-foreground"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            Professional credit analysis, market insights & methodologies for informed decision-making
          </motion.p>
          
          {/* Feature Pills */}
          <motion.div 
            className="mt-8 flex flex-wrap justify-center gap-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            {[
              { icon: BarChart3, label: "Analytics" },
              { icon: TrendingUp, label: "Reports" },
              { icon: Sparkles, label: "Live Data" }
            ].map((item, i) => (
              <div
                key={item.label}
                className="inline-flex items-center gap-2 rounded-full bg-secondary/50 px-4 py-2 text-sm font-medium text-secondary-foreground border border-border"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </div>
            ))}
          </motion.div>
        </div>
      </div>
      
      {/* Subtle background pattern */}
      <div 
        className="absolute inset-0 opacity-[0.015]" 
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--primary)) 1px, transparent 0)`,
          backgroundSize: '24px 24px'
        }} 
      />
    </div>
  );
}