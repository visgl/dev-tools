// Allow overriding default Webpack settings from the Docusaurus config file
import util from 'util';

export default function (
  context,
  opts = {
    resolve: {modules: [], alias: {}},
    debug: false,
    module: {},
    plugins: []
  }
) {
  return {
    name: 'docusaurus-plugin-webpack-config',
    configureWebpack(_config, isServer) {
      const {resolve, debug, module, plugins} = opts;

      // Custom merging
      if (resolve) {
        if (resolve.modules) {
          _config.resolve.modules = resolve.modules;
        }
        Object.assign(_config.resolve.alias, resolve.alias);
      }

      if (debug) {
        console.log(util.inspect(_config.module, {depth: null})); // eslint-disable-line
      }

      // Symlink docs crash otherwise, see https://github.com/facebook/docusaurus/issues/6257
      _config.resolve.symlinks = false;

      if (isServer) {
        return {
          devtool: debug ? 'eval' : false,
          module,
          plugins,
          node: {__dirname: true}
        };
      }
      return {module, plugins};
    }
  };
}
