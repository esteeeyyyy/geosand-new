import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ meta, onPageChange }) {
  if (!meta || meta.last_page <= 1) return null;

  const { current_page, last_page, total } = meta;

  const pages = [];
  const maxVisible = 5;
  let start = Math.max(1, current_page - Math.floor(maxVisible / 2));
  let end = Math.min(last_page, start + maxVisible - 1);
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);

  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="pagination">
      <span className="pagination-info">
        Page {current_page} of {last_page} ({total} items)
      </span>
      <div className="pagination-controls">
        <button
          className="pagination-btn"
          disabled={current_page <= 1}
          onClick={() => onPageChange(current_page - 1)}
        >
          <ChevronLeft size={16} />
        </button>

        {start > 1 && (
          <>
            <button className="pagination-btn" onClick={() => onPageChange(1)}>1</button>
            {start > 2 && <span className="pagination-dots">…</span>}
          </>
        )}

        {pages.map(p => (
          <button
            key={p}
            className={`pagination-btn ${p === current_page ? 'active' : ''}`}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        ))}

        {end < last_page && (
          <>
            {end < last_page - 1 && <span className="pagination-dots">…</span>}
            <button className="pagination-btn" onClick={() => onPageChange(last_page)}>{last_page}</button>
          </>
        )}

        <button
          className="pagination-btn"
          disabled={current_page >= last_page}
          onClick={() => onPageChange(current_page + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
