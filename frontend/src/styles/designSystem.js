// Design System - AI Job Chommie
// Based on the futuristic glassmorphism design from ev-charging-perfect.html

export const colors = {
  // Core background colors
  background: {
    primary: '#0a0e27',
    secondary: '#131829',
    tertiary: '#1a1f3a',
    card: '#1a1f3a',
    cardHover: '#1f2443',
    cardActive: '#242a4d',
  },
  
  // Accent colors with precise values
  accent: {
    cyan: '#00d4ff',
    cyanDark: '#00a8cc',
    cyanLight: '#4de5ff',
    pink: '#ff006e',
    pinkDark: '#cc0058',
    pinkLight: '#ff3390',
    purple: '#a855f7',
    purpleDark: '#8644c5',
    purpleLight: '#c084fc',
    yellow: '#fbbf24',
    yellowDark: '#f59e0b',
    green: '#10b981',
  },
  
  // Text hierarchy
  text: {
    primary: '#ffffff',
    secondary: '#94a3b8',
    tertiary: '#64748b',
    dim: '#475569',
    muted: '#334155',
  },
  
  // Border system
  border: {
    default: '#2a3456',
    light: '#3b4569',
    dark: '#1e2539',
  },
};

export const effects = {
  // Glow effects
  glow: {
    cyan: '0 0 40px rgba(0, 212, 255, 0.6)',
    cyanIntense: '0 0 60px rgba(0, 212, 255, 0.8)',
    pink: '0 0 40px rgba(255, 0, 110, 0.6)',
    purple: '0 0 40px rgba(168, 85, 247, 0.6)',
    mixed: '0 0 50px rgba(136, 68, 197, 0.5)',
  },
  
  // Gradients
  gradients: {
    primary: 'linear-gradient(135deg, #00d4ff 0%, #ff006e 100%)',
    secondary: 'linear-gradient(135deg, #a855f7 0%, #ff006e 100%)',
    tertiary: 'linear-gradient(135deg, #00d4ff 0%, #a855f7 50%, #ff006e 100%)',
    surface: 'linear-gradient(180deg, rgba(26, 31, 58, 0.95) 0%, rgba(19, 24, 41, 0.98) 100%)',
    overlay: 'linear-gradient(180deg, transparent 0%, rgba(10, 14, 39, 0.5) 100%)',
  },
  
  // Shadows
  shadows: {
    card: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 1px rgba(0, 212, 255, 0.1)',
    button: '0 10px 30px rgba(0, 0, 0, 0.3)',
    hover: '0 25px 70px rgba(0, 0, 0, 0.6)',
    active: 'inset 0 2px 10px rgba(0, 0, 0, 0.3)',
  },
  
  // Glassmorphism
  glass: {
    background: 'rgba(26, 31, 58, 0.95)',
    blur: 'blur(20px)',
    saturate: 'saturate(150%)',
  },
};

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '40px',
  '3xl': '48px',
};

export const borderRadius = {
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  '2xl': '24px',
  '3xl': '32px',
  full: '9999px',
};

export const transitions = {
  smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  elastic: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
};

export const typography = {
  fontFamily: {
    primary: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", "Inter", "Helvetica Neue", sans-serif',
    mono: '"SF Mono", "Monaco", "Inconsolata", "Fira Code", monospace',
  },
  
  fontSize: {
    xs: '11px',
    sm: '13px',
    base: '14px',
    md: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '32px',
    '4xl': '42px',
    '5xl': '48px',
    '6xl': '64px',
  },
  
  fontWeight: {
    thin: 200,
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.6,
  },
  
  letterSpacing: {
    tight: '-1px',
    normal: '0',
    wide: '0.5px',
    wider: '1.2px',
    widest: '1.5px',
  },
};

export const animations = {
  durations: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms',
    slower: '1000ms',
  },
  
  keyframes: {
    fadeIn: `
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `,
    
    pulse: `
      @keyframes pulse {
        0%, 100% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.8;
          transform: scale(1.05);
        }
      }
    `,
    
    glow: `
      @keyframes glow {
        0%, 100% {
          box-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
        }
        50% {
          box-shadow: 0 0 30px rgba(0, 212, 255, 0.8);
        }
      }
    `,
    
    shimmer: `
      @keyframes shimmer {
        0% { transform: translateX(-200%); }
        100% { transform: translateX(200%); }
      }
    `,
    
    float: `
      @keyframes float {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-10px); }
      }
    `,
    
    rotate: `
      @keyframes rotate {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `,
  },
};

export const breakpoints = {
  xs: '0px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

export const zIndex = {
  behind: -1,
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  overlay: 1200,
  modal: 1300,
  popover: 1400,
  tooltip: 1500,
};

// Utility function to apply glassmorphism effect
export const glassmorphism = (opacity = 0.95) => `
  background: rgba(26, 31, 58, ${opacity});
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  border: 1px solid ${colors.border.default};
`;

// Utility function for responsive design
export const mediaQuery = (breakpoint) => `@media (min-width: ${breakpoints[breakpoint]})`;

// Export complete theme object
export const theme = {
  colors,
  effects,
  spacing,
  borderRadius,
  transitions,
  typography,
  animations,
  breakpoints,
  zIndex,
  glassmorphism,
  mediaQuery,
};

export default theme;
