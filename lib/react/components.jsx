/**
 * VekoJS React Components
 * Composants React réutilisables
 * @module veko/react/components
 */

import React, { useState, useEffect, useRef, forwardRef, createContext, useContext } from 'react';

// ============= LAYOUT COMPONENTS =============

/**
 * Container principal de l'application
 */
export function AppContainer({ children, className = '', ...props }) {
  return (
    <div className={`veko-app ${className}`} {...props}>
      {children}
    </div>
  );
}

/**
 * Layout avec Header, Main et Footer
 */
export function Layout({ header, footer, sidebar, children, className = '' }) {
  return (
    <div className={`veko-layout ${className}`}>
      {header && <header className="veko-header">{header}</header>}
      <div className="veko-layout-body">
        {sidebar && <aside className="veko-sidebar">{sidebar}</aside>}
        <main className="veko-main">{children}</main>
      </div>
      {footer && <footer className="veko-footer">{footer}</footer>}
    </div>
  );
}

// ============= NAVIGATION COMPONENTS =============

/**
 * Composant Link avec prefetching
 */
export const Link = forwardRef(function Link({ 
  href, 
  children, 
  prefetch = true,
  className = '',
  onClick,
  ...props 
}, ref) {
  const [isPrefetched, setIsPrefetched] = useState(false);
  
  const handleMouseEnter = () => {
    if (prefetch && !isPrefetched && typeof window !== 'undefined') {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = href;
      document.head.appendChild(link);
      setIsPrefetched(true);
    }
  };
  
  const handleClick = (e) => {
    if (onClick) {
      onClick(e);
    }
    
    // SPA navigation si supporté
    if (!e.defaultPrevented && !e.metaKey && !e.ctrlKey) {
      // Navigation SPA sera gérée par le router
    }
  };
  
  return (
    <a
      ref={ref}
      href={href}
      className={`veko-link ${className}`}
      onMouseEnter={handleMouseEnter}
      onClick={handleClick}
      {...props}
    >
      {children}
    </a>
  );
});

/**
 * Navigation avec état actif
 */
export function Nav({ items, activeHref, className = '' }) {
  return (
    <nav className={`veko-nav ${className}`}>
      <ul className="veko-nav-list">
        {items.map((item, index) => (
          <li 
            key={item.href || index}
            className={`veko-nav-item ${activeHref === item.href ? 'active' : ''}`}
          >
            <Link href={item.href} className="veko-nav-link">
              {item.icon && <span className="veko-nav-icon">{item.icon}</span>}
              <span className="veko-nav-text">{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ============= UI COMPONENTS =============

/**
 * Bouton avec variantes
 */
export const Button = forwardRef(function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  type = 'button',
  className = '',
  onClick,
  ...props
}, ref) {
  const baseClass = 'veko-button';
  const variantClass = `veko-button-${variant}`;
  const sizeClass = `veko-button-${size}`;
  const loadingClass = loading ? 'veko-button-loading' : '';
  
  return (
    <button
      ref={ref}
      type={type}
      className={`${baseClass} ${variantClass} ${sizeClass} ${loadingClass} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading && (
        <span className="veko-button-spinner">
          <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </span>
      )}
      <span className={loading ? 'opacity-0' : ''}>{children}</span>
    </button>
  );
});

/**
 * Input avec label et erreur
 */
export const Input = forwardRef(function Input({
  label,
  error,
  helper,
  type = 'text',
  className = '',
  required = false,
  ...props
}, ref) {
  const id = props.id || props.name;
  
  return (
    <div className={`veko-input-group ${error ? 'has-error' : ''} ${className}`}>
      {label && (
        <label htmlFor={id} className="veko-input-label">
          {label}
          {required && <span className="veko-required">*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        type={type}
        className="veko-input"
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${id}-error` : helper ? `${id}-helper` : undefined}
        {...props}
      />
      {error && (
        <span id={`${id}-error`} className="veko-input-error" role="alert">
          {error}
        </span>
      )}
      {helper && !error && (
        <span id={`${id}-helper`} className="veko-input-helper">
          {helper}
        </span>
      )}
    </div>
  );
});

/**
 * Select avec options
 */
export const Select = forwardRef(function Select({
  label,
  error,
  options = [],
  placeholder = 'Sélectionner...',
  className = '',
  required = false,
  ...props
}, ref) {
  const id = props.id || props.name;
  
  return (
    <div className={`veko-select-group ${error ? 'has-error' : ''} ${className}`}>
      {label && (
        <label htmlFor={id} className="veko-select-label">
          {label}
          {required && <span className="veko-required">*</span>}
        </label>
      )}
      <select
        ref={ref}
        id={id}
        className="veko-select"
        aria-invalid={error ? 'true' : 'false'}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option 
            key={option.value} 
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <span className="veko-select-error" role="alert">{error}</span>
      )}
    </div>
  );
});

/**
 * Textarea avec auto-resize
 */
export const Textarea = forwardRef(function Textarea({
  label,
  error,
  autoResize = false,
  className = '',
  required = false,
  ...props
}, ref) {
  const textareaRef = useRef(null);
  const combinedRef = ref || textareaRef;
  const id = props.id || props.name;
  
  useEffect(() => {
    if (autoResize && combinedRef.current) {
      const textarea = combinedRef.current;
      const resize = () => {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
      };
      
      textarea.addEventListener('input', resize);
      resize();
      
      return () => textarea.removeEventListener('input', resize);
    }
  }, [autoResize, combinedRef]);
  
  return (
    <div className={`veko-textarea-group ${error ? 'has-error' : ''} ${className}`}>
      {label && (
        <label htmlFor={id} className="veko-textarea-label">
          {label}
          {required && <span className="veko-required">*</span>}
        </label>
      )}
      <textarea
        ref={combinedRef}
        id={id}
        className="veko-textarea"
        aria-invalid={error ? 'true' : 'false'}
        {...props}
      />
      {error && (
        <span className="veko-textarea-error" role="alert">{error}</span>
      )}
    </div>
  );
});

// ============= FEEDBACK COMPONENTS =============

/**
 * Spinner de chargement
 */
export function Spinner({ size = 'md', color = 'primary', className = '' }) {
  const sizeMap = { sm: 16, md: 24, lg: 32, xl: 48 };
  const s = sizeMap[size] || size;
  
  return (
    <svg
      className={`veko-spinner veko-spinner-${color} ${className}`}
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

/**
 * Composant de chargement plein écran
 */
export function LoadingScreen({ message = 'Chargement...', logo }) {
  return (
    <div className="veko-loading-screen">
      <div className="veko-loading-content">
        {logo && <div className="veko-loading-logo">{logo}</div>}
        <Spinner size="lg" />
        <p className="veko-loading-message">{message}</p>
      </div>
    </div>
  );
}

/**
 * Alert / Notification
 */
export function Alert({ 
  type = 'info', 
  title, 
  children, 
  dismissible = false,
  onDismiss,
  className = ''
}) {
  const [isVisible, setIsVisible] = useState(true);
  
  if (!isVisible) return null;
  
  const handleDismiss = () => {
    setIsVisible(false);
    if (onDismiss) onDismiss();
  };
  
  const icons = {
    info: '💡',
    success: '✅',
    warning: '⚠️',
    error: '❌'
  };
  
  return (
    <div className={`veko-alert veko-alert-${type} ${className}`} role="alert">
      <span className="veko-alert-icon">{icons[type]}</span>
      <div className="veko-alert-content">
        {title && <strong className="veko-alert-title">{title}</strong>}
        <div className="veko-alert-message">{children}</div>
      </div>
      {dismissible && (
        <button 
          className="veko-alert-dismiss" 
          onClick={handleDismiss}
          aria-label="Fermer"
        >
          ×
        </button>
      )}
    </div>
  );
}

/**
 * Toast notification
 */
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  
  const addToast = (toast) => {
    const id = Date.now();
    setToasts(prev => [...prev, { ...toast, id }]);
    
    if (toast.duration !== 0) {
      setTimeout(() => {
        removeToast(id);
      }, toast.duration || 5000);
    }
  };
  
  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };
  
  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="veko-toast-container">
        {toasts.map(toast => (
          <div 
            key={toast.id} 
            className={`veko-toast veko-toast-${toast.type || 'info'}`}
          >
            <span className="veko-toast-message">{toast.message}</span>
            <button 
              className="veko-toast-close" 
              onClick={() => removeToast(toast.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// ============= MODAL COMPONENTS =============

/**
 * Modal dialog
 */
export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children,
  footer,
  size = 'md',
  closeOnOverlay = true,
  closeOnEscape = true,
  className = ''
}) {
  const modalRef = useRef(null);
  
  // Fermer avec Escape
  useEffect(() => {
    if (!closeOnEscape || !isOpen) return;
    
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, closeOnEscape]);
  
  // Focus trap
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    }
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  return (
    <div 
      className="veko-modal-overlay"
      onClick={closeOnOverlay ? onClose : undefined}
    >
      <div 
        ref={modalRef}
        className={`veko-modal veko-modal-${size} ${className}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="veko-modal-header">
          {title && <h2 id="modal-title" className="veko-modal-title">{title}</h2>}
          <button className="veko-modal-close" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>
        <div className="veko-modal-body">{children}</div>
        {footer && <div className="veko-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ============= DATA DISPLAY COMPONENTS =============

/**
 * Card container
 */
export function Card({ 
  children, 
  title, 
  subtitle,
  header,
  footer,
  image,
  hoverable = false,
  className = '' 
}) {
  return (
    <div className={`veko-card ${hoverable ? 'veko-card-hoverable' : ''} ${className}`}>
      {image && (
        <div className="veko-card-image">
          <img src={image.src} alt={image.alt || ''} />
        </div>
      )}
      {header && <div className="veko-card-header">{header}</div>}
      <div className="veko-card-body">
        {title && <h3 className="veko-card-title">{title}</h3>}
        {subtitle && <p className="veko-card-subtitle">{subtitle}</p>}
        {children}
      </div>
      {footer && <div className="veko-card-footer">{footer}</div>}
    </div>
  );
}

/**
 * Table avec tri et pagination
 */
export function Table({ 
  columns, 
  data, 
  sortable = false,
  loading = false,
  emptyMessage = 'Aucune donnée',
  className = ''
}) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  
  const sortedData = React.useMemo(() => {
    if (!sortable || !sortConfig.key) return data;
    
    return [...data].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [data, sortConfig, sortable]);
  
  const handleSort = (key) => {
    if (!sortable) return;
    
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };
  
  return (
    <div className={`veko-table-container ${className}`}>
      <table className="veko-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th 
                key={column.key}
                onClick={() => handleSort(column.key)}
                className={sortable ? 'sortable' : ''}
              >
                {column.label}
                {sortable && sortConfig.key === column.key && (
                  <span className="sort-indicator">
                    {sortConfig.direction === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="veko-table-loading">
                <Spinner />
              </td>
            </tr>
          ) : sortedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="veko-table-empty">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedData.map((row, index) => (
              <tr key={row.id || index}>
                {columns.map((column) => (
                  <td key={column.key}>
                    {column.render ? column.render(row[column.key], row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Pagination
 */
export function Pagination({ 
  currentPage, 
  totalPages, 
  onPageChange,
  showFirstLast = true,
  maxVisible = 5,
  className = ''
}) {
  const pages = React.useMemo(() => {
    const result = [];
    const half = Math.floor(maxVisible / 2);
    let start = Math.max(1, currentPage - half);
    let end = Math.min(totalPages, start + maxVisible - 1);
    
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      result.push(i);
    }
    
    return result;
  }, [currentPage, totalPages, maxVisible]);
  
  return (
    <nav className={`veko-pagination ${className}`} aria-label="Pagination">
      {showFirstLast && (
        <button
          className="veko-pagination-btn"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          aria-label="Première page"
        >
          «
        </button>
      )}
      <button
        className="veko-pagination-btn"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Page précédente"
      >
        ‹
      </button>
      
      {pages[0] > 1 && (
        <>
          <button className="veko-pagination-btn" onClick={() => onPageChange(1)}>1</button>
          {pages[0] > 2 && <span className="veko-pagination-ellipsis">...</span>}
        </>
      )}
      
      {pages.map(page => (
        <button
          key={page}
          className={`veko-pagination-btn ${page === currentPage ? 'active' : ''}`}
          onClick={() => onPageChange(page)}
          aria-current={page === currentPage ? 'page' : undefined}
        >
          {page}
        </button>
      ))}
      
      {pages[pages.length - 1] < totalPages && (
        <>
          {pages[pages.length - 1] < totalPages - 1 && (
            <span className="veko-pagination-ellipsis">...</span>
          )}
          <button className="veko-pagination-btn" onClick={() => onPageChange(totalPages)}>
            {totalPages}
          </button>
        </>
      )}
      
      <button
        className="veko-pagination-btn"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Page suivante"
      >
        ›
      </button>
      {showFirstLast && (
        <button
          className="veko-pagination-btn"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          aria-label="Dernière page"
        >
          »
        </button>
      )}
    </nav>
  );
}

// ============= HEAD COMPONENT =============

/**
 * Composant pour gérer les balises <head>
 */
export function Head({ title, description, keywords, children }) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    
    if (title) {
      document.title = title;
    }
    
    if (description) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'description';
        document.head.appendChild(meta);
      }
      meta.content = description;
    }
    
    if (keywords) {
      let meta = document.querySelector('meta[name="keywords"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'keywords';
        document.head.appendChild(meta);
      }
      meta.content = Array.isArray(keywords) ? keywords.join(', ') : keywords;
    }
  }, [title, description, keywords]);
  
  return null;
}

export default {
  // Layout
  AppContainer,
  Layout,
  // Navigation
  Link,
  Nav,
  // UI
  Button,
  Input,
  Select,
  Textarea,
  // Feedback
  Spinner,
  LoadingScreen,
  Alert,
  ToastProvider,
  useToast,
  Modal,
  // Data Display
  Card,
  Table,
  Pagination,
  // Head
  Head
};
