module.exports = {
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: './tsconfig.json',
    },
    plugins: ['@typescript-eslint'],
    extends: [
        'eslint:recommended',
        '@typescript-eslint/recommended',
    ],
    rules: {
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-inferrable-types': 'off',
        '@typescript-eslint/no-empty-function': 'warn',
        'prefer-const': 'error',
        'no-var': 'error',
        'no-console': 'warn',
        'eqeqeq': 'error',
        'curly': 'error',
        'no-throw-literal': 'error',
    },
    env: {
        node: true,
        es6: true,
    },
    ignorePatterns: [
        'dist/',
        'node_modules/',
        '*.js',
    ],
};