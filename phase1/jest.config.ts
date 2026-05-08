import type { Config } from 'jest'

const config: Config = {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^next/server$': '<rootDir>/src/__mocks__/next-server.ts',
    '^pdf-parse$': '<rootDir>/src/__mocks__/pdf-parse.ts',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        isolatedModules: true,
        tsconfig: {
          moduleResolution: 'node',
          paths: { '@/*': ['./src/*'] },
        },
      },
    ],
  },
}

export default config
