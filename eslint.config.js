import js from '@eslint/js';

export default [
  // Base recommended rules
  js.configs.recommended,

  // Project-wide defaults
  {
    languageOptions: {
      sourceType: 'module',
      globals: {
        // Browser globals (app code runs in the browser)
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        crypto: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLSelectElement: 'readonly',
        HTMLButtonElement: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        DragEvent: 'readonly',
        DataTransferItem: 'readonly',
        DataTransferItemList: 'readonly',
        FileSystemDirectoryHandle: 'readonly',
        FileSystemFileHandle: 'readonly',
        navigator: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        TextDecoder: 'readonly',
        TextEncoder: 'readonly',
        btoa: 'readonly',
        atob: 'readonly',
        structuredClone: 'readonly',
        requestAnimationFrame: 'readonly',
        KeyboardEvent: 'readonly',
        MouseEvent: 'readonly',
        // Node.js globals (tests run in Node via Jest)
        process: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        __dirname: 'readonly',
      },
    },
    rules: {
      // Relax rules that conflict with the project's style
      'no-console': 'off', // console.error used for error logging
      radix: ['error', 'always'], // require parseInt(x, 10) — catches misplaced radix
    },
  },

  // Test files — allow Jest globals
  {
    files: ['tests/**/*.js', 'integration-tests/**/*.js'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
      },
    },
    rules: {
      // Tests use _-prefix for intentionally unused params/vars (e.g. in
      // parameterized test titles, mock stubs, readability-only captures).
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // Ignore generated files
  {
    ignores: [
      'node_modules/**',
      'rpcs3-mcp-server/**', // separate Node.js project
    ],
  },
];
