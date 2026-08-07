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
    // Barrel re-exports — no logic.
    '!js/lib/ps3-save-lib/index.js',
    '!js/ui/events.js',
    // Entry point — orchestrates browser flows (jsdom-untestable).
    '!js/ui/app.js',
  ],
  coverageThreshold: {
    // Per-path gates (enforced only when --coverage is passed).
    // Each glob is checked independently — a file must satisfy every pattern
    // it matches.
    //
    // Gate 1: UI — moderately high thresholds.  The remaining drag is a
    // handful of browser-only canvas/FS-Access paths and dead branches; all
    // other UI files are at 95%+ branches.
    './js/ui/': {
      lines: 90,
      statements: 90,
      branches: 85,
      functions: 90,
    },
    // Gate 2: Core logic — strict thresholds (checked per-directory).
    './js/lib/': {
      lines: 95,
      statements: 95,
      branches: 95,
      functions: 95,
    },
    './js/des-db/': {
      lines: 95,
      statements: 95,
      branches: 95,
      functions: 95,
    },
    './js/des-savefile/': {
      lines: 95,
      statements: 95,
      branches: 95,
      functions: 95,
    },
  },
};
