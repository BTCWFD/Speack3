module.exports = {
  testEnvironment: 'node',
  // Only files ending in .test.js are test suites; shared helpers in
  // __tests__/ (e.g. helpers.js) are imported, not run as suites.
  testMatch: ['**/__tests__/**/*.test.js'],
};
