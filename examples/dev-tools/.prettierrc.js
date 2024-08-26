const {getPrettierConfig} = require('@vis.gl/dev-tools/configuration');

const config = getPrettierConfig({
  overrides: {
    // Make any changes to default config here
  },
  // Log the resolved config
  debug: true
});

module.exports = config;
