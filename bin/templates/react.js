/**
 * React Components Generator
 * Generates React pages and components for SSR
 */

const fs = require('fs');
const path = require('path');

class ReactGenerator {
  constructor(config) {
    this.config = config;
    this.baseDir = config.srcDir 
      ? path.join(config.projectPath, 'src') 
      : config.projectPath;
    this.ext = config.typescript ? 'tsx' : 'jsx';
  }

  generate() {
    if (!this.config.react && 
        this.config.template !== 'react' && 
        this.config.template !== 'react-typescript') {
      return;
    }

    fs.mkdirSync(path.join(this.baseDir, 'pages'), { recursive: true });
    fs.mkdirSync(path.join(this.baseDir, 'components'), { recursive: true });
    
    this.generatePages();
    this.generateComponents();
    this.generateHooks();
    this.generateContext();
  }

  generatePages() {
    const ts = this.config.typescript;
    
    // Home page
    const homePage = ts ? `
import React from 'react';

interface HomeProps {
  title?: string;
  message?: string;
}

const Home: React.FC<HomeProps> = ({ title = 'Home', message = 'Welcome!' }) => {
  return (
    <div className="home-page">
      <section className="hero">
        <h1>{title}</h1>
        <p>{message}</p>
        
        <div className="hero-buttons">
          <a href="/about" className="btn btn-primary">Learn More</a>
          <a href="/api/health" className="btn btn-secondary">API Status</a>
        </div>
      </section>
      
      <section className="features">
        <h2>Features</h2>
        <div className="features-grid">
          <FeatureCard 
            icon="🚀" 
            title="Fast & Modern" 
            description="Built with React SSR for optimal performance"
          />
          <FeatureCard 
            icon="⚡" 
            title="Hot Reload" 
            description="Instant updates during development"
          />
          <FeatureCard 
            icon="🔒" 
            title="Secure" 
            description="Security best practices built-in"
          />
        </div>
      </section>
    </div>
  );
};

interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description }) => (
  <div className="feature-card">
    <span className="feature-icon">{icon}</span>
    <h3>{title}</h3>
    <p>{description}</p>
  </div>
);

export default Home;
`.trim() : `
import React from 'react';

const Home = ({ title = 'Home', message = 'Welcome!' }) => {
  return (
    <div className="home-page">
      <section className="hero">
        <h1>{title}</h1>
        <p>{message}</p>
        
        <div className="hero-buttons">
          <a href="/about" className="btn btn-primary">Learn More</a>
          <a href="/api/health" className="btn btn-secondary">API Status</a>
        </div>
      </section>
      
      <section className="features">
        <h2>Features</h2>
        <div className="features-grid">
          <FeatureCard 
            icon="🚀" 
            title="Fast & Modern" 
            description="Built with React SSR for optimal performance"
          />
          <FeatureCard 
            icon="⚡" 
            title="Hot Reload" 
            description="Instant updates during development"
          />
          <FeatureCard 
            icon="🔒" 
            title="Secure" 
            description="Security best practices built-in"
          />
        </div>
      </section>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }) => (
  <div className="feature-card">
    <span className="feature-icon">{icon}</span>
    <h3>{title}</h3>
    <p>{description}</p>
  </div>
);

module.exports = Home;
`.trim();
    
    fs.writeFileSync(path.join(this.baseDir, 'pages', `Home.${this.ext}`), homePage);
    
    // About page
    const aboutPage = ts ? `
import React from 'react';

interface AboutProps {
  title?: string;
}

const About: React.FC<AboutProps> = ({ title = 'About' }) => {
  return (
    <div className="about-page">
      <h1>{title}</h1>
      
      <section className="content">
        <p className="lead">
          Welcome to ${this.config.projectName}, built with VekoJS and React Server-Side Rendering.
        </p>
        
        <h2>Our Technology Stack</h2>
        <ul className="tech-list">
          <li>
            <strong>VekoJS</strong> - Modern Node.js framework
          </li>
          <li>
            <strong>React</strong> - Component-based UI library
          </li>
          <li>
            <strong>Express</strong> - Fast, minimal web framework
          </li>
          ${this.config.typescript ? `<li>
            <strong>TypeScript</strong> - Type-safe JavaScript
          </li>` : ''}
        </ul>
        
        <h2>Key Features</h2>
        <div className="features-list">
          <div className="feature-item">
            <span className="icon">⚡</span>
            <div>
              <h3>Server-Side Rendering</h3>
              <p>Fast initial page loads and SEO-friendly content</p>
            </div>
          </div>
          <div className="feature-item">
            <span className="icon">🔄</span>
            <div>
              <h3>Hydration</h3>
              <p>Seamless transition to interactive client-side React</p>
            </div>
          </div>
          <div className="feature-item">
            <span className="icon">📦</span>
            <div>
              <h3>Component Library</h3>
              <p>Reusable UI components for consistent design</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
`.trim() : `
import React from 'react';

const About = ({ title = 'About' }) => {
  return (
    <div className="about-page">
      <h1>{title}</h1>
      
      <section className="content">
        <p className="lead">
          Welcome to ${this.config.projectName}, built with VekoJS and React Server-Side Rendering.
        </p>
        
        <h2>Our Technology Stack</h2>
        <ul className="tech-list">
          <li>
            <strong>VekoJS</strong> - Modern Node.js framework
          </li>
          <li>
            <strong>React</strong> - Component-based UI library
          </li>
          <li>
            <strong>Express</strong> - Fast, minimal web framework
          </li>
        </ul>
        
        <h2>Key Features</h2>
        <div className="features-list">
          <div className="feature-item">
            <span className="icon">⚡</span>
            <div>
              <h3>Server-Side Rendering</h3>
              <p>Fast initial page loads and SEO-friendly content</p>
            </div>
          </div>
          <div className="feature-item">
            <span className="icon">🔄</span>
            <div>
              <h3>Hydration</h3>
              <p>Seamless transition to interactive client-side React</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

module.exports = About;
`.trim();
    
    fs.writeFileSync(path.join(this.baseDir, 'pages', `About.${this.ext}`), aboutPage);
  }

  generateComponents() {
    const ts = this.config.typescript;
    
    // Button component
    const button = ts ? `
import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  className = ''
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-lg transition-all';
  
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100'
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={\`\${baseStyles} \${variants[variant]} \${sizes[size]} \${className} \${disabled ? 'opacity-50 cursor-not-allowed' : ''}\`}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  );
};

export default Button;
`.trim() : `
import React from 'react';

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  className = ''
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-lg transition-all';
  
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100'
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={\`\${baseStyles} \${variants[variant]} \${sizes[size]} \${className} \${disabled ? 'opacity-50 cursor-not-allowed' : ''}\`}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  );
};

module.exports = Button;
`.trim();
    
    fs.writeFileSync(path.join(this.baseDir, 'components', `Button.${this.ext}`), button);
    
    // Card component
    const card = ts ? `
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
  className?: string;
  hoverable?: boolean;
}

const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  footer,
  className = '',
  hoverable = false
}) => {
  return (
    <div className={\`bg-white rounded-xl shadow-md overflow-hidden \${hoverable ? 'hover:shadow-xl transition-shadow' : ''} \${className}\`}>
      {(title || subtitle) && (
        <div className="px-6 py-4 border-b">
          {title && <h3 className="text-lg font-semibold">{title}</h3>}
          {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
        </div>
      )}
      
      <div className="p-6">
        {children}
      </div>
      
      {footer && (
        <div className="px-6 py-4 bg-gray-50 border-t">
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;
`.trim() : `
import React from 'react';

const Card = ({
  children,
  title,
  subtitle,
  footer,
  className = '',
  hoverable = false
}) => {
  return (
    <div className={\`bg-white rounded-xl shadow-md overflow-hidden \${hoverable ? 'hover:shadow-xl transition-shadow' : ''} \${className}\`}>
      {(title || subtitle) && (
        <div className="px-6 py-4 border-b">
          {title && <h3 className="text-lg font-semibold">{title}</h3>}
          {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
        </div>
      )}
      
      <div className="p-6">
        {children}
      </div>
      
      {footer && (
        <div className="px-6 py-4 bg-gray-50 border-t">
          {footer}
        </div>
      )}
    </div>
  );
};

module.exports = Card;
`.trim();
    
    fs.writeFileSync(path.join(this.baseDir, 'components', `Card.${this.ext}`), card);
    
    // Modal component
    const modal = ts ? `
import React, { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md'
}) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl'
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className={\`relative bg-white rounded-xl shadow-2xl w-full \${sizes[size]} mx-4 animate-fadeIn\`}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-xl font-semibold">{title}</h2>
            <button 
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-full transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
`.trim() : `
import React, { useEffect } from 'react';

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md'
}) => {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl'
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className={\`relative bg-white rounded-xl shadow-2xl w-full \${sizes[size]} mx-4\`}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-xl font-semibold">{title}</h2>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
              ✕
            </button>
          </div>
        )}
        
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

module.exports = Modal;
`.trim();
    
    fs.writeFileSync(path.join(this.baseDir, 'components', `Modal.${this.ext}`), modal);
    
    // Index file
    const index = ts ? `
export { default as Button } from './Button';
export { default as Card } from './Card';
export { default as Modal } from './Modal';
`.trim() : `
module.exports = {
  Button: require('./Button'),
  Card: require('./Card'),
  Modal: require('./Modal')
};
`.trim();
    
    fs.writeFileSync(path.join(this.baseDir, 'components', `index.${this.ext}`), index);
  }

  generateHooks() {
    const ts = this.config.typescript;
    const hooksDir = path.join(this.baseDir, 'hooks');
    fs.mkdirSync(hooksDir, { recursive: true });
    
    const hooks = ts ? `
import { useState, useEffect, useCallback, useRef } from 'react';

// Local Storage Hook
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  const setValue = (value: T) => {
    setStoredValue(value);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  };

  return [storedValue, setValue];
}

// Debounce Hook
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Fetch Hook
interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useFetch<T>(url: string): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Network response was not ok');
      const json = await response.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

// Toggle Hook
export function useToggle(initialValue = false): [boolean, () => void] {
  const [value, setValue] = useState(initialValue);
  const toggle = useCallback(() => setValue(v => !v), []);
  return [value, toggle];
}

// Previous Value Hook
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

// Click Outside Hook
export function useClickOutside(callback: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callback();
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [callback]);

  return ref;
}
`.trim() : `
const { useState, useEffect, useCallback, useRef } = require('react');

// Local Storage Hook
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  const setValue = (value) => {
    setStoredValue(value);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  };

  return [storedValue, setValue];
}

// Debounce Hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Fetch Hook
function useFetch(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Network response was not ok');
      const json = await response.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

// Toggle Hook
function useToggle(initialValue = false) {
  const [value, setValue] = useState(initialValue);
  const toggle = useCallback(() => setValue(v => !v), []);
  return [value, toggle];
}

// Click Outside Hook
function useClickOutside(callback) {
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        callback();
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [callback]);

  return ref;
}

module.exports = {
  useLocalStorage,
  useDebounce,
  useFetch,
  useToggle,
  useClickOutside
};
`.trim();
    
    fs.writeFileSync(path.join(hooksDir, `index.${this.ext}`), hooks);
  }

  generateContext() {
    const ts = this.config.typescript;
    const contextDir = path.join(this.baseDir, 'context');
    fs.mkdirSync(contextDir, { recursive: true });
    
    const context = ts ? `
import React, { createContext, useContext, useReducer, ReactNode } from 'react';

// Types
interface AppState {
  user: User | null;
  theme: 'light' | 'dark';
  loading: boolean;
}

interface User {
  id: string;
  name: string;
  email: string;
}

type AppAction =
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' }
  | { type: 'SET_LOADING'; payload: boolean };

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  setUser: (user: User | null) => void;
  toggleTheme: () => void;
}

// Initial state
const initialState: AppState = {
  user: null,
  theme: 'light',
  loading: false
};

// Reducer
const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    default:
      return state;
  }
};

// Context
const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider
interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const setUser = (user: User | null) => {
    dispatch({ type: 'SET_USER', payload: user });
  };

  const toggleTheme = () => {
    dispatch({ 
      type: 'SET_THEME', 
      payload: state.theme === 'light' ? 'dark' : 'light' 
    });
  };

  return (
    <AppContext.Provider value={{ state, dispatch, setUser, toggleTheme }}>
      {children}
    </AppContext.Provider>
  );
};

// Hook
export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export default AppContext;
`.trim() : `
const React = require('react');
const { createContext, useContext, useReducer } = React;

// Initial state
const initialState = {
  user: null,
  theme: 'light',
  loading: false
};

// Reducer
const appReducer = (state, action) => {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    default:
      return state;
  }
};

// Context
const AppContext = createContext(undefined);

// Provider
const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const setUser = (user) => {
    dispatch({ type: 'SET_USER', payload: user });
  };

  const toggleTheme = () => {
    dispatch({ 
      type: 'SET_THEME', 
      payload: state.theme === 'light' ? 'dark' : 'light' 
    });
  };

  return React.createElement(
    AppContext.Provider,
    { value: { state, dispatch, setUser, toggleTheme } },
    children
  );
};

// Hook
const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

module.exports = {
  AppContext,
  AppProvider,
  useApp
};
`.trim();
    
    fs.writeFileSync(path.join(contextDir, `AppContext.${this.ext}`), context);
  }
}

module.exports = ReactGenerator;
