import {getVitestConfig} from './modules/dev-tools/src/configuration/get-vitest-config.ts';

export default getVitestConfig({
  projects: {
    node: {
      test: {
        include: ['modules/**/*.spec.ts'],
        // TypeScript compiler transforms become substantially slower under coverage on CI.
        testTimeout: 120_000
      }
    }
  },
  coverage: {
    include: ['modules/*/src/**/*.{ts,tsx,js,jsx}'],
    exclude: ['modules/docusaurus-website/src/components/**']
  }
});
