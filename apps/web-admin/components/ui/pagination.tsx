import { cn } from "@/lib/cn";

export function Pagination({
  page,
  pageCount,
  onPageChange,
  className
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (pageCount <= 1) {
    return null;
  }

  const pages = getVisiblePages(page, pageCount);

  return (
    <nav className={cn("flex items-center gap-2", className)} aria-label="Pagination">
      <PageButton
        label="Previous"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      />
      {pages.map((item, index) =>
        item === "ellipsis" ? (
          <span key={"ellipsis-" + index} className="px-2 text-sm text-text/50">
            ...
          </span>
        ) : (
          <PageButton
            key={item}
            label={String(item)}
            active={item === page}
            onClick={() => onPageChange(item)}
          />
        )
      )}
      <PageButton
        label="Next"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      />
    </nav>
  );
}

function PageButton({
  label,
  active,
  disabled,
  onClick
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-9 min-w-9 items-center justify-center rounded-pill border px-3 text-sm font-semibold transition duration-180",
        active
          ? "border-brand bg-brand text-white"
          : "border-line bg-surface text-text hover:border-brand hover:text-brand",
        disabled ? "cursor-not-allowed opacity-50" : ""
      )}
      aria-current={active ? "page" : undefined}
    >
      {label}
    </button>
  );
}

function getVisiblePages(page: number, pageCount: number) {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  if (page <= 3) {
    return [1, 2, 3, 4, "ellipsis", pageCount] as const;
  }

  if (page >= pageCount - 2) {
    return [1, "ellipsis", pageCount - 3, pageCount - 2, pageCount - 1, pageCount] as const;
  }

  return [1, "ellipsis", page - 1, page, page + 1, "ellipsis", pageCount] as const;
}
