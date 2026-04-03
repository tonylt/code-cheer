import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  coverageThreshold: {
    global: {
      lines: 80,
    },
  },
  coverageReporters: ['text', 'lcov'],
  restoreMocks: true,
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
}

export default config
