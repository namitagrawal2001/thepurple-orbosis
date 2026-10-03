export default [
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-unreachable': 'error',
      'no-unexpected-multiline': 'error',
      'valid-typeof': 'error',
    },
  },
  {
    ignores: ['.next/**', 'out/**', 'build/**', 'node_modules/**'],
  },
];
