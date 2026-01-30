/**
 * PDF Signer Theme
 * Design system tokens for consistent styling
 */

export const Theme = {
  // Border Radius
  borderRadius: {
    sm: 'rounded',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    xl: 'rounded-2xl',
    full: 'rounded-full'
  },

  // Colors
  colors: {
    primary: {
      50: 'bg-cyan-50',
      100: 'bg-cyan-100',
      200: 'bg-cyan-200',
      300: 'bg-cyan-300',
      400: 'bg-cyan-400',
      500: 'bg-cyan-500',
      600: 'bg-cyan-600',
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
    success: {
      50: 'bg-emerald-50',
      100: 'bg-emerald-100',
      200: 'bg-emerald-200',
      300: 'bg-emerald-300',
      400: 'bg-emerald-400',
      500: 'bg-emerald-500',
      600: 'bg-emerald-600',
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
    }
  },

  // Typography
  typography: {
    fontSize: {
      xs: 'text-xs',
      sm: 'text-sm',
      base: 'text-base',
      lg: 'text-lg',
      xl: 'text-xl',
      '2xl': 'text-2xl',
    },
    fontWeight: {
      normal: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
      bold: 'font-bold',
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
 */
export const getButtonClasses = (variant = 'primary', size = 'md', disabled = false) => {
  const base = `${Theme.borderRadius.md} ${Theme.typography.fontSize.sm} ${Theme.typography.fontWeight.semibold} transition-colors`
  
  if (disabled) {
    return `${base} ${Theme.colors.neutral[300]} ${Theme.colors.neutral.text[500]} cursor-not-allowed`
  }

  const variants = {
    primary: `${Theme.colors.primary[500]} text-white hover:${Theme.colors.primary[600]}`,
    success: `${Theme.colors.success[500]} text-white hover:${Theme.colors.success[600]}`,
    secondary: `bg-white ${Theme.colors.neutral.border[300]} ${Theme.colors.neutral.text[700]} hover:${Theme.colors.neutral[50]}`,
    danger: `${Theme.colors.error[500]} text-white hover:${Theme.colors.error[600]}`,
  }

  const sizes = {
    sm: 'px-3 py-1.5',
    md: 'px-4 py-2',
    lg: 'px-6 py-3',
  }

  return `${base} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md}`
}

/**
 * Get standardized input classes
 */
export const getInputClasses = (error = false, disabled = false) => {
  const base = `${Theme.borderRadius.md} border ${Theme.typography.fontSize.sm} px-4 py-2.5 focus:outline-none focus:ring-2`
  
  if (disabled) {
    return `${base} ${Theme.colors.neutral[50]} ${Theme.colors.neutral.text[500]} cursor-not-allowed`
  }

  if (error) {
    return `${base} ${Theme.colors.error.border[300]} ${Theme.colors.error[50]} focus:ring-red-500`
  }

  return `${base} ${Theme.colors.primary.border[300]} bg-white focus:ring-cyan-500`
}
