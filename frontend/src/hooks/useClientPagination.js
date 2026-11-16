import { useEffect, useMemo, useState } from 'react';

export const TABLE_PAGE_SIZE = 10;

export default function useClientPagination(items = [], pageSize = TABLE_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const total = items.length;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, lastPage);

  useEffect(() => {
    if (page > lastPage) setPage(lastPage);
  }, [lastPage, page]);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [currentPage, items, pageSize]);

  return {
    pageItems,
    page: currentPage,
    setPage,
    meta: {
      current_page: currentPage,
      last_page: lastPage,
      per_page: pageSize,
      total,
    },
  };
}
