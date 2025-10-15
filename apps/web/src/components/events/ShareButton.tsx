"use client";

import { ExternalLink } from "lucide-react";

interface ShareButtonProps {
  title: string;
  text: string;
}

export default function ShareButton({ title, text }: ShareButtonProps) {
  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text,
          url: window.location.href
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        // Could add a toast notification here in the future
      }
    } catch (error) {
      // Handle share errors silently
      console.log('Share failed:', error);
    }
  };

  return (
    <button
      onClick={handleShare}
      className="btn btn-secondary w-full justify-center"
    >
      <ExternalLink size={16} />
      Share Event
    </button>
  );
}