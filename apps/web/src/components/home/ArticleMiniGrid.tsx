import Link from 'next/link';
import { ArticleRow } from '@/lib/articles';

interface ArticleMiniGridProps {
  items: ArticleRow[];
  domain: 'esg' | 'credit';
  className?: string;
}

function formatHomeDate(date: Date): string {
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) {
    return 'Today';
  } else if (diffDays === 2) {
    return 'Yesterday';
  } else if (diffDays <= 7) {
    return `${diffDays - 1} days ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }
}

export default function ArticleMiniGrid({ items, domain, className = '' }: ArticleMiniGridProps) {
  if (items.length === 0) {
    return (
      <div className={`text-center py-8 text-muted-foreground ${className}`}>
        <p>No recent articles found.</p>
        <Link 
          href={`/${domain}/articles`}
          className="text-primary hover:text-primary/80 underline mt-2 inline-block"
        >
          View all articles →
        </Link>
      </div>
    );
  }

  return (
    <div className={`grid gap-4 md:gap-6 ${className}`}>
      {items.map((item) => (
        <Link
          key={item.id}
          href={`/${domain}/articles/${item.id}`}
          className="group block bg-card text-card-foreground border border-border rounded-lg hover:shadow-md transition-shadow duration-200"
        >
          <div className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
              <h3 className="font-medium text-card-foreground group-hover:text-primary transition-colors line-clamp-2 flex-1">
                {item.title}
              </h3>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-sm text-muted-foreground sm:flex-shrink-0">
                {item.source && (
                  <span className="font-medium text-card-foreground truncate max-w-[120px]">
                    {item.source}
                  </span>
                )}
                <time className="whitespace-nowrap">
                  {item.published && formatHomeDate(new Date(item.published))}
                </time>
              </div>
            </div>
          </div>
        </Link>
      ))}
      
      <div className="text-center pt-4">
        <Link 
          href={`/${domain}/articles`}
          className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium"
        >
          View all articles
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}