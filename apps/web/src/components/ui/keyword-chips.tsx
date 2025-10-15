interface KeywordChipsProps {
  items: string[];
  className?: string;
  maxVisible?: number;
}

export default function KeywordChips({ items, className = "", maxVisible = 3 }: KeywordChipsProps) {
  if (items.length === 0) return null;
  
  const visibleItems = items.slice(0, maxVisible);
  const remainingCount = items.length - maxVisible;
  
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {visibleItems.map(item => (
        <span 
          key={item} 
          className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
        >
          {item}
        </span>
      ))}
      {remainingCount > 0 && (
        <span 
          className="rounded-full bg-[var(--brand)]/10 px-2.5 py-1 text-[10px] font-medium text-[var(--brand)] cursor-help"
          title={`${remainingCount} more: ${items.slice(maxVisible).join(', ')}`}
        >
          +{remainingCount}
        </span>
      )}
    </div>
  );
}