"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ArticlesPaginatorProps {
  currentPage: number;
  totalPages: number;
  domain: string;
}

export default function ArticlesPaginator({
  currentPage,
  totalPages,
  domain,
}: ArticlesPaginatorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setPage = (page: number) => {
    const params = new URLSearchParams(searchParams);
    if (page === 1) {
      params.delete("page");
    } else {
      params.set("page", page.toString());
    }
    const queryString = params.toString();
    const url = `/${domain}/articles${queryString ? `?${queryString}` : ""}`;
    router.push(url);
  };

  if (totalPages <= 1) return null;

  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  // Generate page numbers to display
  const getPageNumbers = () => {
    const delta = 2; // Show 2 pages on each side of current page
    const range = [];
    const rangeWithDots = [];

    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  const pageNumbers = getPageNumbers();

  return (
    <nav className="flex items-center justify-center space-x-1 mt-8 mb-4" aria-label="Pagination">
      {/* Previous Button */}
      <button
        onClick={() => setPage(currentPage - 1)}
        disabled={!hasPrev}
        className={`
          relative inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-200
          ${hasPrev
            ? 'text-muted-foreground hover:text-foreground hover:bg-accent border border-border hover:border-accent-foreground'
            : 'text-muted-foreground/50 cursor-not-allowed border border-border/50'
          }
        `}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        <span className="hidden sm:inline">Previous</span>
      </button>

      {/* Page Numbers */}
      <div className="flex items-center space-x-1">
        {pageNumbers.map((page, index) => {
          if (page === '...') {
            return (
              <span
                key={`dots-${index}`}
                className="px-3 py-2 text-sm text-muted-foreground"
              >
                ...
              </span>
            );
          }

          const pageNum = page as number;
          const isActive = pageNum === currentPage;

          return (
            <button
              key={pageNum}
              onClick={() => setPage(pageNum)}
              className={`
                relative inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 min-w-[40px]
                ${isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent border border-border hover:border-accent-foreground'
                }
              `}
              aria-current={isActive ? 'page' : undefined}
              aria-label={`Page ${pageNum}`}
            >
              {pageNum}
            </button>
          );
        })}
      </div>

      {/* Next Button */}
      <button
        onClick={() => setPage(currentPage + 1)}
        disabled={!hasNext}
        className={`
          relative inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-200
          ${hasNext
            ? 'text-muted-foreground hover:text-foreground hover:bg-accent border border-border hover:border-accent-foreground'
            : 'text-muted-foreground/50 cursor-not-allowed border border-border/50'
          }
        `}
        aria-label="Next page"
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRight className="h-4 w-4 ml-1" />
      </button>
    </nav>
  );
}