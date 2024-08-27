/** @typedef {import('@vis.gl/dev-tools').OcularConfig} OcularConfig */
import {resolve} from 'path';

/** @type {OcularConfig} */
let ocularConfig = {
  lint: {
    paths: ['modules']
  },

  aliases: {
    test: resolve('./test')
  },

  entry: {
    test: 'test/node.ts',
    'test-browser': 'test/index.html',
    size: []
  }
};

export default ocularConfig;
