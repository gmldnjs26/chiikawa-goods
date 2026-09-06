/**
 * `be/`와 같은 러너 (fe/CLAUDE.md §5). 순수함수(`lib/` · `modules/item/badge.ts`)만 테스트한다.
 * 컴포넌트 테스트 스택은 v0에 넣지 않는다. `.ts` config는 ts-node를 요구해서 `.mjs`다.
 */

/** @type {import('jest').Config} */
const config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      // Next용 tsconfig는 module=esnext다. jest는 commonjs로 돌린다
      { tsconfig: { module: 'commonjs', moduleResolution: 'node', jsx: 'react-jsx' } },
    ],
  },
  testEnvironment: 'node',
};

export default config;
