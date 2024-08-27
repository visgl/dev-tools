/**
 * This script adds custom heading ids to all files in the docs directory.
 * Usage: ocular-doc-headers ./docs
 * 
 * The headings in our API reference may have format such as
 
    + ### `opacity` (Number, optional)
    + ### `opacity?: number`
    + ### `getPosition` ([Function](../../developer-guide/using-layers.md#accessors), optional) ![transition-enabled](https://img.shields.io/badge/transition-enabled-green.svg?style=flat-square")
    + ### `needsRedraw(options?: {clearRedrawFlags?: boolean}): string | false`
  
 * The default generated hash id by Docusaurus will be something like:

    + #-opacity-number-optional
    + #-opacity-number-
    + #-getposition-functiondeveloper-guideusing-layersmdaccessors-optional-transition-enabledhttpsimgshieldsiobadgetransition-enabled-greensvgstyleflat-square
    + #-needsredraw-options-clearredrawflags-boolean-string-false-

 * They are long, difficult to read, subject to how the documentation is written, and when the call signature changes.
 * This script appends a custom id tag to the end of such headings, so that their hash ids will look like:

    + #opacity
    + #opacity
    + #getposition
    + #needsredraw

 */
import fs from 'fs/promises';

/** Should match if the line is a header */
const headerTest = /^(#+)\s+(?<headerContent>.*?)\s*(?<customId>\{#[\w\-]+\})?$/;
/** Should match if the header describes an API */
const apiTest = /^`((?<code>\w+)[^`]*)`\s*(\(.*?\)|$)/;

/** Parse a single line of text in a .md file.
 * @returns new content in 3 parts if custom id is needed, null otherwise.
 */
export function getCustomId(
  line: string
): [hash: string, headerContent: string, customId: string] | null {
  const m = line.trim().match(headerTest);
  if (!m) {
    return null;
  }
  const m1 = m.groups!.headerContent.match(apiTest);
  if (!m1) {
    return null;
  }
  const customId = m1.groups!.code.toLowerCase();
  return [m[1], m[2], `{#${customId}}`];
}

/** Process a md file. Rewrites the file content if custom ids are needed. */
export async function processFile(path: string): Promise<void> {
  const context = await fs.readFile(path, {encoding: 'utf-8'});
  let changed = false;
  const lines = context.split('\n').map((line) => {
    const customId = getCustomId(line);
    if (customId) {
      changed = true;
      return customId.join(' ');
    }
    return line;
  });
  if (changed) {
    console.log(path);
    await fs.writeFile(path, lines.join('\n'));
  }
}
