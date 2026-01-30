module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true,
    jest: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  plugins: ['react', 'react-hooks'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
      importAssertions: true,
    },
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    // Security rules for templates
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    
    // Prevent arbitrary network calls (templates should only use ctx.api.baseUrl)
    // Exception: Allow fetch in template-sdk package since it's the official API wrapper
    // Exception: Allow fetch in Next.js API routes (/app/api/*) and Server Components (/app/e/*)
    'no-restricted-globals': [
      'error',
      {
        name: 'fetch',
        message: 'Use ctx.api wrapper instead of direct fetch calls',
      },
    ],
    
    // Override no-restricted-globals for specific patterns
    'no-unused-vars': ['warn', { 
      varsIgnorePattern: '^_',
      argsIgnorePattern: '^_',
    }],
    
    // React rules
    'react/react-in-jsx-scope': 'off', // Not needed in modern React
    'react/prop-types': 'off', // We're not using TypeScript, so skip prop-types for now
    'react/no-danger': 'warn', // Warn about dangerouslySetInnerHTML
    
    // General rules
    'prefer-const': 'error',
    'no-var': 'error',
    'no-unused-vars': 'warn',
  },
  overrides: [
    {
      // Allow fetch in template-sdk since it's the official API wrapper
      files: ['packages/template-sdk/**/*.js'],
      rules: {
        'no-restricted-globals': 'off',
      },
    },
    {
      // Allow fetch in Next.js API routes and Server Components (server-side code)
      files: [
        'renderer/app/api/**/*.js',
        'renderer/app/e/**/page.js',
        'renderer/app/e/**/otp-login.js',
      ],
      rules: {
        'no-restricted-globals': 'off',
        'react/no-unescaped-entities': 'off',
      },
    },
  ],
};