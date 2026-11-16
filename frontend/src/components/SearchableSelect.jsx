import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export default function SearchableSelect({
  id,
  value,
  options,
  onChange,
  placeholder = 'Select an option',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No matching option found.',
  required = false,
  disabled = false,
  searchable,
  className = '',
  style,
  containerStyle,
  ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const searchRef = useRef(null);

  const selected = options.find((option) => String(option.value) === String(value));
  const showSearch = searchable ?? options.length > 6;
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) => String(option.label).toLowerCase().includes(normalizedQuery));
  }, [options, query]);

  useEffect(() => {
    const closeOnOutsidePress = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('pointerdown', closeOnOutsidePress);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePress);
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  const closeMenu = () => {
    setOpen(false);
    setQuery('');
  };

  const selectOption = (option) => {
    onChange(String(option.value));
    closeMenu();
  };

  return (
    <div className="searchable-select" ref={rootRef} style={containerStyle}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`form-select searchable-select-trigger${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        aria-required={required}
        aria-label={ariaLabel}
        disabled={disabled}
        style={style}
        onClick={() => (open ? closeMenu() : setOpen(true))}
        onKeyDown={(event) => {
          if (event.key === 'Escape') closeMenu();
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className={selected ? '' : 'text-muted'}>{selected?.label || placeholder}</span>
        <ChevronDown size={17} aria-hidden="true" />
      </button>

      {required && (
        <input
          className="searchable-select-validation"
          value={value ?? ''}
          onChange={(event) => event.preventDefault()}
          required
          tabIndex={-1}
          aria-hidden="true"
          onInvalid={(event) => {
            event.preventDefault();
            setOpen(true);
            window.setTimeout(() => triggerRef.current?.focus(), 0);
          }}
        />
      )}

      {open && (
        <div className="searchable-select-menu" id={`${id}-options`} role="listbox">
          {showSearch && (
            <div className="searchable-select-header">
              <div className="searchable-select-search">
                <Search size={16} aria-hidden="true" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                />
              </div>
              <button type="button" className="searchable-select-close" onClick={closeMenu} aria-label="Close options">
                <X size={18} />
              </button>
            </div>
          )}

          <div className="searchable-select-options">
            {filteredOptions.length === 0 ? (
              <div className="searchable-select-empty">{emptyMessage}</div>
            ) : filteredOptions.map((option) => {
              const isSelected = String(option.value) === String(value);
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`searchable-select-option${isSelected ? ' is-selected' : ''}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => selectOption(option)}
                >
                  <span>{option.label}</span>
                  {isSelected && <Check size={16} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
