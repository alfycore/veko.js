/**
 * Static Assets Generator
 * Generates CSS and JavaScript files
 */

const fs = require('fs');
const path = require('path');

class StaticGenerator {
  constructor(config) {
    this.config = config;
    this.baseDir = config.srcDir 
      ? path.join(config.projectPath, 'src') 
      : config.projectPath;
    this.publicDir = path.join(this.baseDir, 'public');
  }

  generate() {
    fs.mkdirSync(path.join(this.publicDir, 'css'), { recursive: true });
    fs.mkdirSync(path.join(this.publicDir, 'js'), { recursive: true });
    fs.mkdirSync(path.join(this.publicDir, 'images'), { recursive: true });
    
    if (!this.config.tailwind) {
      this.generateCSS();
    }
    this.generateJS();
    this.generateFavicon();
  }

  generateCSS() {
    const css = `
/* ========================================
   ${this.config.projectName} - Styles
   Built with VekoJS
   ======================================== */

/* Reset & Base */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  /* Colors */
  --primary: #6366f1;
  --primary-dark: #4f46e5;
  --secondary: #22c55e;
  --accent: #f59e0b;
  --danger: #ef4444;
  
  /* Grays */
  --gray-50: #f9fafb;
  --gray-100: #f3f4f6;
  --gray-200: #e5e7eb;
  --gray-300: #d1d5db;
  --gray-400: #9ca3af;
  --gray-500: #6b7280;
  --gray-600: #4b5563;
  --gray-700: #374151;
  --gray-800: #1f2937;
  --gray-900: #111827;
  
  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  --spacing-2xl: 3rem;
  
  /* Typography */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'Fira Code', 'Consolas', monospace;
  
  /* Borders */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 1rem;
  --radius-xl: 1.5rem;
  --radius-full: 9999px;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  
  /* Transitions */
  --transition: 150ms ease-in-out;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  :root {
    --bg: var(--gray-900);
    --text: var(--gray-100);
    --card-bg: var(--gray-800);
    --border: var(--gray-700);
  }
}

html {
  scroll-behavior: smooth;
}

body {
  font-family: var(--font-sans);
  line-height: 1.6;
  color: var(--gray-800);
  background-color: var(--gray-50);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Container */
.container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--spacing-md);
}

/* ========================================
   Header & Navigation
   ======================================== */
.header {
  background: white;
  box-shadow: var(--shadow-sm);
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
}

.nav-brand {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary);
  text-decoration: none;
}

.nav-links {
  display: flex;
  list-style: none;
  gap: var(--spacing-xl);
}

.nav-links a {
  color: var(--gray-600);
  text-decoration: none;
  font-weight: 500;
  transition: color var(--transition);
}

.nav-links a:hover {
  color: var(--primary);
}

.nav-toggle {
  display: none;
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--gray-600);
  cursor: pointer;
}

@media (max-width: 768px) {
  .nav-links {
    display: none;
  }
  
  .nav-toggle {
    display: block;
  }
}

/* ========================================
   Main Content
   ======================================== */
.main-content {
  flex: 1;
  padding: var(--spacing-2xl) 0;
}

/* ========================================
   Hero Section
   ======================================== */
.hero {
  text-align: center;
  padding: var(--spacing-2xl) 0;
}

.hero h1 {
  font-size: 3rem;
  font-weight: 800;
  margin-bottom: var(--spacing-md);
  background: linear-gradient(135deg, var(--primary), var(--secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero p {
  font-size: 1.25rem;
  color: var(--gray-600);
  max-width: 600px;
  margin: 0 auto var(--spacing-xl);
}

.hero-buttons {
  display: flex;
  gap: var(--spacing-md);
  justify-content: center;
  flex-wrap: wrap;
}

/* ========================================
   Buttons
   ======================================== */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: 600;
  border-radius: var(--radius-md);
  text-decoration: none;
  cursor: pointer;
  transition: all var(--transition);
  border: none;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-dark);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.btn-secondary {
  background: transparent;
  color: var(--gray-700);
  border: 2px solid var(--gray-300);
}

.btn-secondary:hover {
  border-color: var(--gray-400);
  background: var(--gray-100);
}

/* ========================================
   Features Section
   ======================================== */
.features {
  padding: var(--spacing-2xl) 0;
}

.features h2 {
  text-align: center;
  font-size: 2rem;
  margin-bottom: var(--spacing-xl);
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--spacing-xl);
}

.feature-card {
  background: white;
  padding: var(--spacing-xl);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  text-align: center;
  transition: transform var(--transition), box-shadow var(--transition);
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-xl);
}

.feature-card i {
  font-size: 2.5rem;
  color: var(--primary);
  margin-bottom: var(--spacing-md);
}

.feature-card h3 {
  font-size: 1.25rem;
  margin-bottom: var(--spacing-sm);
}

.feature-card p {
  color: var(--gray-600);
}

/* ========================================
   Forms
   ======================================== */
.form {
  max-width: 500px;
  margin: 0 auto;
}

.form-group {
  margin-bottom: var(--spacing-lg);
}

.form-group label {
  display: block;
  font-weight: 500;
  margin-bottom: var(--spacing-sm);
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  border: 2px solid var(--gray-300);
  border-radius: var(--radius-md);
  transition: border-color var(--transition), box-shadow var(--transition);
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
}

/* ========================================
   Alerts
   ======================================== */
.alert {
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-lg);
}

.alert-success {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #86efac;
}

.alert-error {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fca5a5;
}

.alert-warning {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fcd34d;
}

/* ========================================
   Cards
   ======================================== */
.card {
  background: white;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  overflow: hidden;
}

.card-header {
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--gray-200);
}

.card-body {
  padding: var(--spacing-lg);
}

.card-footer {
  padding: var(--spacing-lg);
  border-top: 1px solid var(--gray-200);
  background: var(--gray-50);
}

/* ========================================
   Page Content
   ======================================== */
.page {
  max-width: 800px;
  margin: 0 auto;
}

.page h1 {
  font-size: 2.5rem;
  margin-bottom: var(--spacing-lg);
}

.page h2 {
  font-size: 1.75rem;
  margin-top: var(--spacing-xl);
  margin-bottom: var(--spacing-md);
}

.page p {
  color: var(--gray-600);
  margin-bottom: var(--spacing-md);
}

.page ul {
  margin-left: var(--spacing-xl);
  margin-bottom: var(--spacing-md);
}

.lead {
  font-size: 1.25rem;
  color: var(--gray-600);
}

/* ========================================
   Error Page
   ======================================== */
.error-page {
  text-align: center;
  padding: var(--spacing-2xl) 0;
}

.error-code {
  font-size: 8rem;
  font-weight: 800;
  color: var(--primary);
  line-height: 1;
}

.error-message {
  font-size: 1.5rem;
  color: var(--gray-600);
  margin: var(--spacing-lg) 0 var(--spacing-xl);
}

/* ========================================
   Footer
   ======================================== */
.footer {
  background: var(--gray-800);
  color: white;
  padding: var(--spacing-2xl) 0 var(--spacing-lg);
  margin-top: auto;
}

.footer-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-xl);
  margin-bottom: var(--spacing-xl);
}

.footer-section h3,
.footer-section h4 {
  margin-bottom: var(--spacing-md);
}

.footer-section p {
  color: var(--gray-400);
}

.footer-section ul {
  list-style: none;
}

.footer-section ul li {
  margin-bottom: var(--spacing-sm);
}

.footer-section a {
  color: var(--gray-400);
  text-decoration: none;
  transition: color var(--transition);
}

.footer-section a:hover {
  color: white;
}

.social-links {
  display: flex;
  gap: var(--spacing-md);
}

.social-links a {
  font-size: 1.5rem;
}

.footer-bottom {
  text-align: center;
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--gray-700);
  color: var(--gray-400);
}

/* ========================================
   Utilities
   ======================================== */
.text-center { text-align: center; }
.text-left { text-align: left; }
.text-right { text-align: right; }

.mt-1 { margin-top: var(--spacing-xs); }
.mt-2 { margin-top: var(--spacing-sm); }
.mt-3 { margin-top: var(--spacing-md); }
.mt-4 { margin-top: var(--spacing-lg); }
.mt-5 { margin-top: var(--spacing-xl); }

.mb-1 { margin-bottom: var(--spacing-xs); }
.mb-2 { margin-bottom: var(--spacing-sm); }
.mb-3 { margin-bottom: var(--spacing-md); }
.mb-4 { margin-bottom: var(--spacing-lg); }
.mb-5 { margin-bottom: var(--spacing-xl); }

.hidden { display: none !important; }

/* ========================================
   Animations
   ======================================== */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideIn {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.animate-fadeIn {
  animation: fadeIn 0.5s ease-out forwards;
}

.animate-slideIn {
  animation: slideIn 0.3s ease-out forwards;
}

.animate-pulse {
  animation: pulse 2s ease-in-out infinite;
}

/* ========================================
   Responsive
   ======================================== */
@media (max-width: 768px) {
  .hero h1 {
    font-size: 2rem;
  }
  
  .hero p {
    font-size: 1rem;
  }
  
  .footer-grid {
    grid-template-columns: 1fr;
    text-align: center;
  }
  
  .social-links {
    justify-content: center;
  }
}
`.trim();
    
    fs.writeFileSync(path.join(this.publicDir, 'css', 'style.css'), css);
  }

  generateJS() {
    const js = `
/**
 * ${this.config.projectName} - Main JavaScript
 * Built with VekoJS
 */

(function() {
  'use strict';

  // ========================================
  // DOM Ready
  // ========================================
  document.addEventListener('DOMContentLoaded', function() {
    initMobileMenu();
    initSmoothScroll();
    initForms();
    initAnimations();
    initTooltips();
  });

  // ========================================
  // Mobile Menu
  // ========================================
  function initMobileMenu() {
    const menuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (menuBtn && mobileMenu) {
      menuBtn.addEventListener('click', function() {
        mobileMenu.classList.toggle('hidden');
        const icon = menuBtn.querySelector('i');
        if (icon) {
          icon.classList.toggle('fa-bars');
          icon.classList.toggle('fa-times');
        }
      });
    }
  }

  // ========================================
  // Smooth Scroll
  // ========================================
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
      anchor.addEventListener('click', function(e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        
        const target = document.querySelector(targetId);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });
  }

  // ========================================
  // Form Handling
  // ========================================
  function initForms() {
    // Add loading state to form submissions
    document.querySelectorAll('form').forEach(function(form) {
      form.addEventListener('submit', function() {
        const submitBtn = form.querySelector('[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          const originalText = submitBtn.textContent;
          submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
          
          // Re-enable after 10 seconds as fallback
          setTimeout(function() {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
          }, 10000);
        }
      });
    });

    // Real-time validation
    document.querySelectorAll('input[required], textarea[required]').forEach(function(input) {
      input.addEventListener('blur', function() {
        validateInput(this);
      });
    });
  }

  function validateInput(input) {
    const isValid = input.checkValidity();
    input.style.borderColor = isValid ? '' : '#ef4444';
  }

  // ========================================
  // Scroll Animations
  // ========================================
  function initAnimations() {
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1
    };

    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-fadeIn');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    document.querySelectorAll('.feature-card, .card, [data-animate]').forEach(function(el) {
      el.style.opacity = '0';
      observer.observe(el);
    });
  }

  // ========================================
  // Tooltips
  // ========================================
  function initTooltips() {
    document.querySelectorAll('[data-tooltip]').forEach(function(el) {
      el.addEventListener('mouseenter', function(e) {
        showTooltip(e.target, e.target.dataset.tooltip);
      });
      
      el.addEventListener('mouseleave', function() {
        hideTooltip();
      });
    });
  }

  let tooltipEl = null;

  function showTooltip(target, text) {
    hideTooltip();
    
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'tooltip';
    tooltipEl.textContent = text;
    tooltipEl.style.cssText = \`
      position: absolute;
      background: #1f2937;
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      z-index: 1000;
      pointer-events: none;
      white-space: nowrap;
    \`;
    
    document.body.appendChild(tooltipEl);
    
    const rect = target.getBoundingClientRect();
    tooltipEl.style.top = \`\${rect.top - tooltipEl.offsetHeight - 8 + window.scrollY}px\`;
    tooltipEl.style.left = \`\${rect.left + (rect.width / 2) - (tooltipEl.offsetWidth / 2)}px\`;
  }

  function hideTooltip() {
    if (tooltipEl) {
      tooltipEl.remove();
      tooltipEl = null;
    }
  }

  // ========================================
  // Toast Notifications
  // ========================================
  window.showToast = function(message, type = 'success') {
    const toast = document.createElement('div');
    const colors = {
      success: 'bg-green-600',
      error: 'bg-red-600',
      warning: 'bg-yellow-600',
      info: 'bg-blue-600'
    };
    
    toast.className = \`fixed bottom-4 right-4 \${colors[type] || colors.info} text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fadeIn\`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(function() {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease-out';
      setTimeout(function() {
        toast.remove();
      }, 300);
    }, 3000);
  };

  // ========================================
  // Utility Functions
  // ========================================
  window.utils = {
    // Format date
    formatDate: function(date) {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    },
    
    // Format currency
    formatCurrency: function(amount, currency = 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
      }).format(amount);
    },
    
    // Debounce function
    debounce: function(func, wait) {
      let timeout;
      return function executedFunction() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(function() {
          func.apply(context, args);
        }, wait);
      };
    },
    
    // Throttle function
    throttle: function(func, limit) {
      let inThrottle;
      return function() {
        const context = this;
        const args = arguments;
        if (!inThrottle) {
          func.apply(context, args);
          inThrottle = true;
          setTimeout(function() {
            inThrottle = false;
          }, limit);
        }
      };
    },
    
    // Copy to clipboard
    copyToClipboard: function(text) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function() {
          showToast('Copied to clipboard!');
        });
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Copied to clipboard!');
      }
    },
    
    // Fetch with timeout
    fetchWithTimeout: function(url, options = {}, timeout = 5000) {
      return Promise.race([
        fetch(url, options),
        new Promise(function(_, reject) {
          setTimeout(function() {
            reject(new Error('Request timeout'));
          }, timeout);
        })
      ]);
    }
  };

  // ========================================
  // API Client
  // ========================================
  window.api = {
    get: async function(url) {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      return response.json();
    },
    
    post: async function(url, data) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return response.json();
    },
    
    put: async function(url, data) {
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return response.json();
    },
    
    delete: async function(url) {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      return response.json();
    }
  };

  console.log('✨ ${this.config.projectName} loaded successfully');
})();
`.trim();
    
    fs.writeFileSync(path.join(this.publicDir, 'js', 'main.js'), js);
    
    // Generate React bundle placeholder if using React
    if (this.config.react || this.config.template === 'react' || this.config.template === 'react-typescript') {
      fs.writeFileSync(path.join(this.publicDir, 'js', 'bundle.js'), '// React bundle will be generated by build process\n');
    }
  }

  generateFavicon() {
    // Create a simple SVG favicon
    const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20" fill="#6366f1"/>
  <text x="50" y="68" font-family="Arial, sans-serif" font-size="50" font-weight="bold" fill="white" text-anchor="middle">V</text>
</svg>`;
    
    fs.writeFileSync(path.join(this.publicDir, 'favicon.svg'), favicon);
    
    // Also create a simple robots.txt
    fs.writeFileSync(path.join(this.publicDir, 'robots.txt'), `User-agent: *\nAllow: /\n`);
    
    // And a basic manifest.json
    const manifest = {
      name: this.config.projectName,
      short_name: this.config.projectName,
      start_url: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#6366f1',
      icons: []
    };
    
    fs.writeFileSync(path.join(this.publicDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  }
}

module.exports = StaticGenerator;
