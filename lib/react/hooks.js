/**
 * VekoJS React Hooks
 * Hooks personnalisés pour l'intégration avec VekoJS
 * @module veko/react/hooks
 */

import { useState, useEffect, useCallback, useRef, useMemo, useContext, createContext } from 'react';

// ============= CONTEXT VEKO =============

const VekoContext = createContext(null);

/**
 * Provider Veko pour l'application React
 */
export function VekoProvider({ children, initialProps = {} }) {
  const [state, setState] = useState(initialProps);
  const [isHydrated, setIsHydrated] = useState(false);
  
  useEffect(() => {
    // Récupérer les props du serveur
    if (typeof window !== 'undefined' && window.__VEKO_PROPS__) {
      setState(prev => ({ ...prev, ...window.__VEKO_PROPS__ }));
    }
    setIsHydrated(true);
  }, []);
  
  const value = useMemo(() => ({
    ...state,
    isHydrated,
    isServer: typeof window === 'undefined',
    isDev: process.env.NODE_ENV === 'development'
  }), [state, isHydrated]);
  
  return (
    <VekoContext.Provider value={value}>
      {children}
    </VekoContext.Provider>
  );
}

/**
 * Hook pour accéder au contexte Veko
 */
export function useVeko() {
  const context = useContext(VekoContext);
  if (!context) {
    return {
      isHydrated: typeof window !== 'undefined',
      isServer: typeof window === 'undefined',
      isDev: process.env.NODE_ENV === 'development'
    };
  }
  return context;
}

// ============= HOOKS DE DONNÉES =============

/**
 * Hook pour les requêtes API avec cache et revalidation
 */
export function useAPI(url, options = {}) {
  const {
    method = 'GET',
    body = null,
    headers = {},
    revalidateOnFocus = true,
    revalidateOnReconnect = true,
    refreshInterval = 0,
    dedupingInterval = 2000,
    onSuccess = null,
    onError = null,
    initialData = null
  } = options;
  
  const [data, setData] = useState(initialData);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [isValidating, setIsValidating] = useState(false);
  
  const lastFetchRef = useRef(0);
  const abortControllerRef = useRef(null);
  
  const fetchData = useCallback(async (isRevalidation = false) => {
    // Déduplication
    const now = Date.now();
    if (now - lastFetchRef.current < dedupingInterval) {
      return;
    }
    lastFetchRef.current = now;
    
    // Annuler la requête précédente
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    try {
      if (isRevalidation) {
        setIsValidating(true);
      } else {
        setIsLoading(true);
      }
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: body ? JSON.stringify(body) : null,
        signal: abortControllerRef.current.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      setData(result);
      setError(null);
      
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err);
        if (onError) {
          onError(err);
        }
      }
    } finally {
      setIsLoading(false);
      setIsValidating(false);
    }
  }, [url, method, body, headers, dedupingInterval, onSuccess, onError]);
  
  // Fetch initial
  useEffect(() => {
    fetchData();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData]);
  
  // Revalidation au focus
  useEffect(() => {
    if (!revalidateOnFocus || typeof window === 'undefined') return;
    
    const handleFocus = () => fetchData(true);
    window.addEventListener('focus', handleFocus);
    
    return () => window.removeEventListener('focus', handleFocus);
  }, [revalidateOnFocus, fetchData]);
  
  // Revalidation à la reconnexion
  useEffect(() => {
    if (!revalidateOnReconnect || typeof window === 'undefined') return;
    
    const handleOnline = () => fetchData(true);
    window.addEventListener('online', handleOnline);
    
    return () => window.removeEventListener('online', handleOnline);
  }, [revalidateOnReconnect, fetchData]);
  
  // Refresh périodique
  useEffect(() => {
    if (refreshInterval <= 0) return;
    
    const interval = setInterval(() => fetchData(true), refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, fetchData]);
  
  const mutate = useCallback((newData) => {
    if (typeof newData === 'function') {
      setData(prev => newData(prev));
    } else {
      setData(newData);
    }
  }, []);
  
  const revalidate = useCallback(() => fetchData(true), [fetchData]);
  
  return { data, error, isLoading, isValidating, mutate, revalidate };
}

/**
 * Hook pour les mutations (POST, PUT, DELETE)
 */
export function useMutation(url, options = {}) {
  const {
    method = 'POST',
    headers = {},
    onSuccess = null,
    onError = null,
    onSettled = null
  } = options;
  
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const mutate = useCallback(async (body) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      setData(result);
      
      if (onSuccess) {
        await onSuccess(result);
      }
      
      return result;
    } catch (err) {
      setError(err);
      
      if (onError) {
        await onError(err);
      }
      
      throw err;
    } finally {
      setIsLoading(false);
      
      if (onSettled) {
        onSettled();
      }
    }
  }, [url, method, headers, onSuccess, onError, onSettled]);
  
  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);
  
  return { mutate, data, error, isLoading, reset };
}

// ============= HOOKS D'AUTHENTIFICATION =============

/**
 * Hook pour l'authentification Veko
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/check', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      setError(err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);
  
  const login = useCallback(async (credentials) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erreur de connexion');
      }
      
      setUser(data.user);
      return data;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      setUser(null);
    } catch (err) {
      setError(err);
    }
  }, []);
  
  const register = useCallback(async (userData) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erreur d\'inscription');
      }
      
      setUser(data.user);
      return data;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    login,
    logout,
    register,
    checkAuth
  };
}

// ============= HOOKS UTILITAIRES =============

/**
 * Hook pour le stockage local
 */
export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error('useLocalStorage error:', error);
      return initialValue;
    }
  });
  
  const setValue = useCallback((value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error('useLocalStorage error:', error);
    }
  }, [key, storedValue]);
  
  const removeValue = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
      setStoredValue(initialValue);
    } catch (error) {
      console.error('useLocalStorage error:', error);
    }
  }, [key, initialValue]);
  
  return [storedValue, setValue, removeValue];
}

/**
 * Hook pour les media queries
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const mediaQuery = window.matchMedia(query);
    const handler = (event) => setMatches(event.matches);
    
    mediaQuery.addEventListener('change', handler);
    setMatches(mediaQuery.matches);
    
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);
  
  return matches;
}

/**
 * Hook pour le debouncing
 */
export function useDebounce(value, delay = 500) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}

/**
 * Hook pour le throttling
 */
export function useThrottle(value, interval = 500) {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastExecuted = useRef(Date.now());
  
  useEffect(() => {
    const now = Date.now();
    
    if (now - lastExecuted.current >= interval) {
      lastExecuted.current = now;
      setThrottledValue(value);
    } else {
      const timer = setTimeout(() => {
        lastExecuted.current = Date.now();
        setThrottledValue(value);
      }, interval - (now - lastExecuted.current));
      
      return () => clearTimeout(timer);
    }
  }, [value, interval]);
  
  return throttledValue;
}

/**
 * Hook pour détecter les clics extérieurs
 */
export function useClickOutside(ref, handler) {
  useEffect(() => {
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) {
        return;
      }
      handler(event);
    };
    
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

/**
 * Hook pour les raccourcis clavier
 */
export function useKeyPress(targetKey, handler) {
  useEffect(() => {
    const keyHandler = (event) => {
      if (event.key === targetKey) {
        handler(event);
      }
    };
    
    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  }, [targetKey, handler]);
}

/**
 * Hook pour le mode sombre
 */
export function useDarkMode() {
  const [isDarkMode, setIsDarkMode] = useLocalStorage('veko-dark-mode', false);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  
  const enabled = isDarkMode ?? prefersDark;
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const root = window.document.documentElement;
    root.classList.toggle('dark', enabled);
  }, [enabled]);
  
  return [enabled, setIsDarkMode];
}

/**
 * Hook pour le scroll infini
 */
export function useInfiniteScroll(callback, options = {}) {
  const { threshold = 100, enabled = true } = options;
  const observerRef = useRef(null);
  
  const lastElementRef = useCallback((node) => {
    if (!enabled) return;
    
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        callback();
      }
    }, { rootMargin: `${threshold}px` });
    
    if (node) {
      observerRef.current.observe(node);
    }
  }, [callback, threshold, enabled]);
  
  return lastElementRef;
}

/**
 * Hook pour les animations
 */
export function useAnimation(duration = 300) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  
  const show = useCallback(() => {
    setIsVisible(true);
    requestAnimationFrame(() => {
      setIsAnimating(true);
    });
  }, []);
  
  const hide = useCallback(() => {
    setIsAnimating(false);
    setTimeout(() => {
      setIsVisible(false);
    }, duration);
  }, [duration]);
  
  const toggle = useCallback(() => {
    if (isVisible) {
      hide();
    } else {
      show();
    }
  }, [isVisible, show, hide]);
  
  return { isAnimating, isVisible, show, hide, toggle };
}

/**
 * Hook pour la gestion des formulaires
 */
export function useForm(initialValues = {}, validate = null) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleChange = useCallback((event) => {
    const { name, value, type, checked } = event.target;
    setValues(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  }, []);
  
  const handleBlur = useCallback((event) => {
    const { name } = event.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    
    if (validate) {
      const validationErrors = validate(values);
      setErrors(validationErrors);
    }
  }, [values, validate]);
  
  const handleSubmit = useCallback((onSubmit) => {
    return async (event) => {
      event.preventDefault();
      setIsSubmitting(true);
      
      if (validate) {
        const validationErrors = validate(values);
        setErrors(validationErrors);
        
        if (Object.keys(validationErrors).length > 0) {
          setIsSubmitting(false);
          return;
        }
      }
      
      try {
        await onSubmit(values);
      } finally {
        setIsSubmitting(false);
      }
    };
  }, [values, validate]);
  
  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);
  
  const setValue = useCallback((name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
  }, []);
  
  return {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    setValue,
    setValues,
    setErrors
  };
}

export default {
  VekoProvider,
  useVeko,
  useAPI,
  useMutation,
  useAuth,
  useLocalStorage,
  useMediaQuery,
  useDebounce,
  useThrottle,
  useClickOutside,
  useKeyPress,
  useDarkMode,
  useInfiniteScroll,
  useAnimation,
  useForm
};
