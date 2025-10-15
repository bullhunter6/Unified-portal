"use client";

import { useEffect, useState } from "react";

interface SafeHTMLContentProps {
  htmlContent: string;
  className?: string;
}

export default function SafeHTMLContent({ htmlContent, className = "" }: SafeHTMLContentProps) {
  const [sanitizedHTML, setSanitizedHTML] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Basic client-side sanitization - remove script tags and dangerous attributes
    const basicSanitize = (html: string) => {
      return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+="[^"]*"/gi, '')
        .replace(/javascript:/gi, '');
    };

    const cleaned = basicSanitize(htmlContent);
    setSanitizedHTML(cleaned);
    setIsLoading(false);
  }, [htmlContent]);

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-muted rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-a:text-primary prose-strong:text-foreground prose-ul:text-muted-foreground prose-ol:text-muted-foreground prose-li:text-muted-foreground ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
    />
  );
}