import openmrs from '@openmrs/eslint-config';

export default [
  { ignores: ['dist/**', 'coverage/**'] },
  ...openmrs,
  {
    rules: {
      '@typescript-eslint/triple-slash-reference': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
