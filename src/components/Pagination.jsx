import { ChevronLeftIcon, ChevronRightIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';

/**
 * Reusable pagination component for various list views
 * @param {Object} props Component props
 * @param {number} props.currentPage Current active page (1-based)
 * @param {number} props.totalPages Total number of pages
 * @param {function} props.onPageChange Callback when page changes
 */
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  // Don't render pagination if there's only one page
  if (totalPages <= 1) {
    return null;
  }

  // Create array of page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 5; // Show max 5 page numbers
    
    if (totalPages <= maxPagesToShow) {
      // If we have 5 or fewer pages, show all of them
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always include first page
      pages.push(1);
      
      // Add ellipsis if needed
      if (currentPage > 3) {
        pages.push('...');
      }
      
      // Add pages around current page
      const startPage = Math.max(2, currentPage - 1);
      const endPage = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      // Add ellipsis if needed
      if (currentPage < totalPages - 2) {
        pages.push('...');
      }
      
      // Always include last page
      pages.push(totalPages);
    }
    
    return pages;
  };

  return (
    <nav className="flex items-center justify-between border-t border-border px-4 sm:px-0 mt-6">
      <div className="hidden md:-mt-px md:flex">
        {/* Previous Page Button */}
        <Button
          variant="ghost"
          onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="border-t-2 border-transparent rounded-none px-4 pt-4 hover:border-border"
          leadingIcon={ChevronLeftIcon}
        >
          Previous
        </Button>
        
        {/* Page Numbers */}
        {getPageNumbers().map((page, index) => (
          page === '...' ? (
            <span
              key={`ellipsis-${index}`}
              className="inline-flex items-center border-t-2 border-transparent px-4 pt-4 text-sm font-medium text-muted-foreground"
            >
              ...
            </span>
          ) : (
            <Button
              key={page}
              variant="ghost"
              onClick={() => onPageChange(page)}
              className={`border-t-2 rounded-none px-4 pt-4 ${
                currentPage === page
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
              }`}
            >
              {page}
            </Button>
          )
        ))}
        
        {/* Next Page Button */}
        <Button
          variant="ghost"
          onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="border-t-2 border-transparent rounded-none px-4 pt-4 hover:border-border"
          trailingIcon={ChevronRightIcon}
        >
          Next
        </Button>
      </div>
      
      {/* Mobile version */}
      <div className="flex items-center justify-between w-full md:hidden">
        <Button
          variant="outline"
          onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          leadingIcon={ChevronLeftIcon}
        >
          Previous
        </Button>
        
        <div className="text-sm text-foreground">
          Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
        </div>
        
        <Button
          variant="outline"
          onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          trailingIcon={ChevronRightIcon}
        >
          Next
        </Button>
      </div>
    </nav>
  );
};

export default Pagination;
