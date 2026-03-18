"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableWrapper
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";

type SortDirection = "asc" | "desc";

export interface DataGridColumn<T extends Record<string, unknown>> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
  cell?: (row: T) => React.ReactNode;
}

export interface DataGridProps<T extends Record<string, unknown>> {
  title?: string;
  rows: T[];
  columns: DataGridColumn<T>[];
  rowKey: (row: T) => string;
  searchableKeys?: Array<keyof T | string>;
  pageSize?: number;
  selectable?: boolean;
  onSelectionChange?: (keys: string[]) => void;
  rowActions?: (row: T) => React.ReactNode;
  className?: string;
}

export function DataGrid<T extends Record<string, unknown>>({
  title,
  rows,
  columns,
  rowKey,
  searchableKeys,
  pageSize = 10,
  selectable = true,
  onSelectionChange,
  rowActions,
  className
}: DataGridProps<T>) {
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("asc");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const searchable = searchableKeys && searchableKeys.length > 0 ? searchableKeys : columns.map((col) => col.key);

  const filteredRows = rows.filter((row) => {
    if (query.trim().length === 0) {
      return true;
    }

    const normalizedQuery = query.trim().toLowerCase();
    return searchable.some((key) => {
      const value = row[String(key)];
      return String(value ?? "").toLowerCase().includes(normalizedQuery);
    });
  });

  const sortedRows = [...filteredRows].sort((a, b) => {
    if (sortKey === null) {
      return 0;
    }

    const aValue = String(a[sortKey] ?? "").toLowerCase();
    const bValue = String(b[sortKey] ?? "").toLowerCase();

    if (aValue === bValue) {
      return 0;
    }

    if (sortDirection === "asc") {
      return aValue > bValue ? 1 : -1;
    }

    return aValue < bValue ? 1 : -1;
  });

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const pageRows = sortedRows.slice(start, start + pageSize);

  React.useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  React.useEffect(() => {
    onSelectionChange?.(Array.from(selected));
  }, [onSelectionChange, selected]);

  function setSort(nextKey: string) {
    if (sortKey === nextKey) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
      return;
    }

    setSortKey(nextKey);
    setSortDirection("asc");
  }

  function toggleSelected(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function setAllOnPage(checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      pageRows.forEach((row) => {
        const key = rowKey(row);
        if (checked) {
          next.add(key);
        } else {
          next.delete(key);
        }
      });
      return next;
    });
  }

  const allOnPageSelected =
    pageRows.length > 0 && pageRows.every((row) => selected.has(rowKey(row)));

  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 md:flex-row md:items-center md:justify-between">
        <div>
          {title ? <h3 className="font-heading text-xl text-text">{title}</h3> : null}
          <p className="text-sm text-text/65">{sortedRows.length} records</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Filter rows"
            className="w-full sm:w-64"
          />
          {selected.size > 0 ? (
            <span className="rounded-pill border border-line px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-text/70">
              {selected.size} selected
            </span>
          ) : null}
        </div>
      </div>

      {pageRows.length === 0 ? (
        <EmptyState
          title="No records found"
          description="Adjust your filter or expand the selected date range to find matching rows."
        />
      ) : (
        <TableWrapper>
          <Table>
            <TableHead>
              <tr>
                {selectable ? (
                  <TableHeaderCell className="w-12">
                    <Checkbox
                      aria-label="Select all rows"
                      checked={allOnPageSelected}
                      onChange={(event) => setAllOnPage(event.target.checked)}
                    />
                  </TableHeaderCell>
                ) : null}
                {columns.map((column) => {
                  const key = String(column.key);
                  const isSorted = sortKey === key;

                  return (
                    <TableHeaderCell key={key} className={column.headerClassName}>
                      {column.sortable ? (
                        <button
                          type="button"
                          onClick={() => setSort(key)}
                          className="inline-flex items-center gap-1 text-left font-semibold text-text/75 transition hover:text-brand"
                        >
                          <span>{column.header}</span>
                          <span className="text-[10px] uppercase">
                            {isSorted ? (sortDirection === "asc" ? "ASC" : "DESC") : "SORT"}
                          </span>
                        </button>
                      ) : (
                        <span>{column.header}</span>
                      )}
                    </TableHeaderCell>
                  );
                })}
                {rowActions ? <TableHeaderCell className="w-28 text-right">Actions</TableHeaderCell> : null}
              </tr>
            </TableHead>
            <TableBody>
              {pageRows.map((row) => {
                const key = rowKey(row);
                return (
                  <TableRow key={key} className={selected.has(key) ? "bg-hover/45" : ""}>
                    {selectable ? (
                      <TableCell>
                        <Checkbox
                          aria-label={"Select row " + key}
                          checked={selected.has(key)}
                          onChange={() => toggleSelected(key)}
                        />
                      </TableCell>
                    ) : null}
                    {columns.map((column) => {
                      const columnKey = String(column.key);
                      return (
                        <TableCell key={columnKey} className={column.className}>
                          {column.cell ? column.cell(row) : String(row[columnKey] ?? "")}
                        </TableCell>
                      );
                    })}
                    {rowActions ? <TableCell className="text-right">{rowActions(row)}</TableCell> : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableWrapper>
      )}

      <div className="flex justify-end">
        <Pagination page={safePage} pageCount={pageCount} onPageChange={setPage} />
      </div>
    </section>
  );
}
