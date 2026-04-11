module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: ['services/**/*.ts', 'constants/**/*.ts', 'store/**/*.ts'],
  moduleNameMapper: {
    '^react-native-audio-api$': '<rootDir>/__mocks__/react-native-audio-api.ts',
  },
};
