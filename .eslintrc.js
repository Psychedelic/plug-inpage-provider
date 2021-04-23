const pkg = require('./package.json');

module.exports = {
  env: {
    browser: true,
    jest: true,
    es6: true,
  },
  extends: [],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  plugins: [
    '@typescript-eslint',
  ],
  rules: {},
  settings: {
    react: {
      version: pkg.peerDependencies.react,
    },
    'import/resolver': {
      node: {
        extensions: ['.js', '.ts', '.json'],
      },
    },
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        '@typescript-eslint/no-unused-vars': [2, { args: 'none' }],
      },
    },
  ],
};
