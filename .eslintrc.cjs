const {getESLintConfig} = require('@vis.gl/dev-tools/configuration');

module.exports = getESLintConfig({
  react: "18.0.0",
  overrides: {
    rules: {
      'import/no-extraneous-dependencies': 0,
      'import/no-unresolved': 0,
      'no-console': 0,
      'no-continue': 0,
      'no-process-env': 0,
      'no-process-exit': 0
    },

    env: {
      node: true
    }
  }
});
