import {processFile} from '../dist/write-heading-ids.js';
import {glob} from 'glob';

const docsDir = process.argv[2];

main();

/** Traverse all files in the docs directory, append custom ids if necessary */
async function main() {
  const files = await glob(`${docsDir}/**/*.{md,mdx}`);
  for (const f of files) {
    await processFile(f);
  }
}
