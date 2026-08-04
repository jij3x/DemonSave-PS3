export default {
  testEnvironment: 'node',
  // Allow ESM source files (js/**/*.js) to be imported in tests.
  transform: {},
  // Unit tests only.  Integration tests run separately via:
  //   npm run test:integration
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,

  // Coverage configuration (used with --coverage flag, e.g. test:coverage).
  // `npm test` (without --coverage) skips collection entirely.
  collectCoverageFrom: [
    'js/**/*.js',
    // des-db: only index.js contains logic; the rest are frozen data tables.
    '!js/des-db/weapons.js',
    '!js/des-db/armors.js',
    '!js/des-db/rings.js',
    '!js/des-db/goods.js',
    '!js/des-db/spells.js',
    '!js/des-db/hairstyles.js',
    '!js/des-db/class.js',
    '!js/des-db/warps.js',
    '!js/des-db/rel-types.js',
    '!js/des-db/rel-upgrades.js',
    '!js/des-db/idx-upgrade-ref.js',
    // tauri-bridge is now covered by tests/lib/tauri-bridge.test.js
    '!js/lib/ps3-save-lib/index.js', // barrel re-export — no logic
    '!js/ui/events.js', // barrel re-export — no logic
    // Browser-only UI infrastructure — partially covered by jsdom unit tests.
    // The remaining uncovered paths (real File System Access API, Tauri IPC,
    // app orchestration) are exercised via integration tests.
    '!js/ui/app.js', // entry point: orchestrates browser flows
    '!js/ui/io.js', // browser FS Access API + Tauri IPC (jsdom-untestable)
  ],
  coverageThreshold: {
    // Enforced only when --coverage is passed.  Covers all logic modules
    // (save-api, reader, writer, model, crypto, endian, events, controls,
    // dirty).  Browser-only I/O modules are excluded above.
    global: {
      lines: 90,
      statements: 90,
      branches: 85,
      functions: 90,
    },
  },
};
