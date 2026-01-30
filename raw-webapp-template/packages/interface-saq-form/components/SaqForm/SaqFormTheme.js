/**
 * SAQ Form Design System
 * Centralized theme tokens for consistent styling across all components
 * 
 * Usage:
 *   import { SaqFormTheme, getButtonClasses, getCardClasses } from './SaqFormTheme'
 */

export const SaqFormTheme = {
  // Border Radius - Standardized values
  borderRadius: {
    sm: 'rounded',        // 0.25rem - small elements (badges, tags)
    md: 'rounded-lg',    // 0.5rem - default for cards, buttons, inputs
    lg: 'rounded-xl',    // 0.75rem - large cards, modals
    xl: 'rounded-2xl',   // 1rem - extra large cards
    full: 'rounded-full' // circles, pills
  },

  // Colors - Standardized palette
  colors: {
    // Primary (Cyan) - Main actions, primary buttons, interactive elements
    primary: {
      50: 'bg-cyan-50',
      100: 'bg-cyan-100',
      200: 'bg-cyan-200',
      300: 'bg-cyan-300',
      400: 'bg-cyan-400',
      500: 'bg-cyan-500',  // Main primary color
      600: 'bg-cyan-600',   // Hover states
      700: 'bg-cyan-700',
      800: 'bg-cyan-800',
      900: 'bg-cyan-900',
      text: {
        50: 'text-cyan-50',
        100: 'text-cyan-100',
        500: 'text-cyan-500',
        600: 'text-cyan-600',
        700: 'text-cyan-700',
        800: 'text-cyan-800',
        900: 'text-cyan-900',
      },
      border: {
        200: 'border-cyan-200',
        300: 'border-cyan-300',
        400: 'border-cyan-400',
        500: 'border-cyan-500',
        600: 'border-cyan-600',
      }
    },

    // Success (Emerald) - Success states, completed items, positive actions
    success: {
      50: 'bg-emerald-50',
      100: 'bg-emerald-100',
      200: 'bg-emerald-200',
      300: 'bg-emerald-300',
      400: 'bg-emerald-400',
      500: 'bg-emerald-500',  // Main success color
      600: 'bg-emerald-600',  // Hover states
      700: 'bg-emerald-700',
      800: 'bg-emerald-800',
      900: 'bg-emerald-900',
      text: {
        50: 'text-emerald-50',
        100: 'text-emerald-100',
        500: 'text-emerald-500',
        600: 'text-emerald-600',
        700: 'text-emerald-700',
        800: 'text-emerald-800',
        900: 'text-emerald-900',
      },
      border: {
        200: 'border-emerald-200',
        300: 'border-emerald-300',
        400: 'border-emerald-400',
        500: 'border-emerald-500',
      }
    },

    // Warning (Amber) - Warnings, incomplete items, attention needed
    warning: {
      50: 'bg-amber-50',
      100: 'bg-amber-100',
      200: 'bg-amber-200',
      300: 'bg-amber-300',
      400: 'bg-amber-400',
      500: 'bg-amber-500',
      600: 'bg-amber-600',
      700: 'bg-amber-700',
      800: 'bg-amber-800',
      900: 'bg-amber-900',
      text: {
        50: 'text-amber-50',
        100: 'text-amber-100',
        500: 'text-amber-500',
        600: 'text-amber-600',
        700: 'text-amber-700',
        800: 'text-amber-800',
        900: 'text-amber-900',
      },
      border: {
        200: 'border-amber-200',
        300: 'border-amber-300',
        400: 'border-amber-400',
      }
    },

    // Error (Red) - Errors, invalid states, destructive actions
    error: {
      50: 'bg-red-50',
      100: 'bg-red-100',
      200: 'bg-red-200',
      300: 'bg-red-300',
      400: 'bg-red-400',
      500: 'bg-red-500',
      600: 'bg-red-600',
      700: 'bg-red-700',
      800: 'bg-red-800',
      900: 'bg-red-900',
      text: {
        50: 'text-red-50',
        100: 'text-red-100',
        500: 'text-red-500',
        600: 'text-red-600',
        700: 'text-red-700',
        800: 'text-red-800',
      },
      border: {
        200: 'border-red-200',
        300: 'border-red-300',
        400: 'border-red-400',
      }
    },

    // Neutral (Slate) - Default text, backgrounds, borders
    neutral: {
      50: 'bg-slate-50',
      100: 'bg-slate-100',
      200: 'bg-slate-200',
      300: 'bg-slate-300',
      400: 'bg-slate-400',
      500: 'bg-slate-500',
      600: 'bg-slate-600',
      700: 'bg-slate-700',
      800: 'bg-slate-800',
      900: 'bg-slate-900',
      text: {
        50: 'text-slate-50',
        100: 'text-slate-100',
        200: 'text-slate-200',
        300: 'text-slate-300',
        400: 'text-slate-400',
        500: 'text-slate-500',
        600: 'text-slate-600',
        700: 'text-slate-700',
        800: 'text-slate-800',
        900: 'text-slate-900',
      },
      border: {
        200: 'border-slate-200',
        300: 'border-slate-300',
        400: 'border-slate-400',
      }
    },

    // Special colors for SAQ types
    saq: {
      a: {
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        text: 'text-emerald-900',
      },
      'c-vt': {
        bg: 'bg-cyan-50',
        border: 'border-cyan-200',
        text: 'text-cyan-900',
      },
      d: {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        text: 'text-amber-900',
      }
    }
  },

  // Typography
  typography: {
    fontFamily: {
      base: 'font-sans', // Tailwind default system font
      mono: 'font-mono',
    },
    fontSize: {
      xs: 'text-xs',    // 0.75rem - labels, captions
      sm: 'text-sm',    // 0.875rem - body text, buttons
      base: 'text-base', // 1rem - default body
      lg: 'text-lg',    // 1.125rem - subheadings
      xl: 'text-xl',    // 1.25rem - headings
      '2xl': 'text-2xl', // 1.5rem - large headings
    },
    fontWeight: {
      normal: 'font-normal',   // 400
      medium: 'font-medium',   // 500 - body emphasis
      semibold: 'font-semibold', // 600 - headings, buttons
      bold: 'font-bold',       // 700 - strong emphasis
    },
    lineHeight: {
      tight: 'leading-tight',
      normal: 'leading-normal',
      relaxed: 'leading-relaxed',
    }
  },

  // Shadows
  shadows: {
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
    '2xl': 'shadow-2xl',
  }
}

/**
 * Get standardized button classes
 * @param {string} variant - 'primary' | 'success' | 'secondary' | 'danger'
 * @param {string} size - 'sm' | 'md' | 'lg'
 * @param {boolean} disabled - Whether button is disabled
 * @returns {string} Tailwind classes
 */
export const getButtonClasses = (variant = 'primary', size = 'md', disabled = false) => {
  const base = `${SaqFormTheme.borderRadius.md} ${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.semibold} transition-colors`
  
  if (disabled) {
    return `${base} ${SaqFormTheme.colors.neutral[300]} ${SaqFormTheme.colors.neutral.text[500]} cursor-not-allowed`
  }

  const variants = {
    primary: `${SaqFormTheme.colors.primary[500]} text-white hover:${SaqFormTheme.colors.primary[600]}`,
    success: `${SaqFormTheme.colors.success[500]} text-white hover:${SaqFormTheme.colors.success[600]}`,
    secondary: `bg-white ${SaqFormTheme.colors.neutral.border[300]} ${SaqFormTheme.colors.neutral.text[700]} hover:${SaqFormTheme.colors.neutral[50]}`,
    danger: `${SaqFormTheme.colors.error[500]} text-white hover:${SaqFormTheme.colors.error[600]}`,
  }

  const sizes = {
    sm: 'px-3 py-1.5',
    md: 'px-4 py-2',
    lg: 'px-6 py-3',
  }

  return `${base} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md}`
}

/**
 * Get standardized card classes
 * @param {string} variant - 'default' | 'highlighted' | 'success' | 'warning'
 * @returns {string} Tailwind classes
 */
export const getCardClasses = (variant = 'default') => {
  const base = `${SaqFormTheme.borderRadius.md} border ${SaqFormTheme.shadows.sm}`
  
  const variants = {
    default: `bg-white ${SaqFormTheme.colors.neutral.border[200]}`,
    highlighted: `${SaqFormTheme.colors.primary[50]} ${SaqFormTheme.colors.primary.border[200]}`,
    success: `${SaqFormTheme.colors.success[50]} ${SaqFormTheme.colors.success.border[200]}`,
    warning: `${SaqFormTheme.colors.warning[50]} ${SaqFormTheme.colors.warning.border[200]}`,
  }

  return `${base} ${variants[variant] || variants.default}`
}

/**
 * Get standardized input classes
 * @param {boolean} error - Whether input has error state
 * @param {boolean} disabled - Whether input is disabled
 * @returns {string} Tailwind classes
 */
export const getInputClasses = (error = false, disabled = false) => {
  const base = `${SaqFormTheme.borderRadius.md} border ${SaqFormTheme.typography.fontSize.sm} px-4 py-2.5 focus:outline-none focus:ring-2`
  
  if (disabled) {
    return `${base} ${SaqFormTheme.colors.neutral[50]} ${SaqFormTheme.colors.neutral.text[500]} cursor-not-allowed`
  }

  if (error) {
    return `${base} ${SaqFormTheme.colors.error.border[300]} ${SaqFormTheme.colors.error[50]} focus:ring-red-500`
  }

  return `${base} ${SaqFormTheme.colors.primary.border[300]} bg-white focus:ring-cyan-500`
}

/**
 * Get standardized badge classes
 * @param {string} variant - 'primary' | 'success' | 'warning' | 'error' | 'neutral'
 * @returns {string} Tailwind classes
 */
export const getBadgeClasses = (variant = 'primary') => {
  const base = `${SaqFormTheme.borderRadius.sm} ${SaqFormTheme.typography.fontSize.xs} ${SaqFormTheme.typography.fontWeight.semibold} px-2.5 py-0.5 inline-flex items-center`
  
  const variants = {
    primary: `${SaqFormTheme.colors.primary[100]} ${SaqFormTheme.colors.primary.text[700]}`,
    success: `${SaqFormTheme.colors.success[100]} ${SaqFormTheme.colors.success.text[700]}`,
    warning: `${SaqFormTheme.colors.warning[100]} ${SaqFormTheme.colors.warning.text[700]}`,
    error: `${SaqFormTheme.colors.error[100]} ${SaqFormTheme.colors.error.text[700]}`,
    neutral: `${SaqFormTheme.colors.neutral[100]} ${SaqFormTheme.colors.neutral.text[700]}`,
  }

  return `${base} ${variants[variant] || variants.primary}`
}

/**
 * Get standardized alert/notification classes
 * @param {string} variant - 'success' | 'warning' | 'error' | 'info'
 * @returns {object} Object with bg, border, text classes
 */
export const getAlertClasses = (variant = 'info') => {
  const variants = {
    success: {
      bg: SaqFormTheme.colors.success[50],
      border: SaqFormTheme.colors.success.border[200],
      text: SaqFormTheme.colors.success.text[800],
      icon: SaqFormTheme.colors.success.text[600],
    },
    warning: {
      bg: SaqFormTheme.colors.warning[50],
      border: SaqFormTheme.colors.warning.border[200],
      text: SaqFormTheme.colors.warning.text[800],
      icon: SaqFormTheme.colors.warning.text[600],
    },
    error: {
      bg: SaqFormTheme.colors.error[50],
      border: SaqFormTheme.colors.error.border[200],
      text: SaqFormTheme.colors.error.text[800],
      icon: SaqFormTheme.colors.error.text[600],
    },
    info: {
      bg: SaqFormTheme.colors.primary[50],
      border: SaqFormTheme.colors.primary.border[200],
      text: SaqFormTheme.colors.primary.text[800],
      icon: SaqFormTheme.colors.primary.text[600],
    },
  }

  return variants[variant] || variants.info
}
