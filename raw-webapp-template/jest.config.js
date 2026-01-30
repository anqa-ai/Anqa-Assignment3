export default {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '<rootDir>/packages/**/__tests__/**/*.(js|jsx)',
    '<rootDir>/packages/**/*.(test|spec).(js|jsx)',
    '<rootDir>/renderer/**/__tests__/**/*.(test|spec).(js|jsx)',
  ],
  collectCoverageFrom: [
    'packages/**/*.{js,jsx}',
    'renderer/**/*.{js,jsx}',
    '!**/__tests__/**',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  extensionsToTreatAsEsm: ['.jsx'],
  transform: {},
};