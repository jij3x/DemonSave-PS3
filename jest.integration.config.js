/**
 * Jest config for integration tests only.
 *
 * Integration tests are kept separate from unit tests so that `npm test`
 * (which uses jest.config.js → tests/**) runs fast without touching disk.
 *
 * Run via:  npm run test:integration
 */
export default {
  testEnvironment: 'node',
  // Allow ESM source files (js/**/*.js) to be imported in tests.
  transform: {},
  testMatch: ['**/integration-tests/**/*.test.js'],
  verbose: true,
};
