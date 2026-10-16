import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) })

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: ['.next/**', 'node_modules/**', 'public/**', 'tests/**', 'playwright-report/**', 'test-results/**', 'next-env.d.ts'],
  },
  {
    rules: {
      // Plain <img> is intentional for the small local logo assets
      '@next/next/no-img-element': 'off',
    },
  },
]

export default eslintConfig
