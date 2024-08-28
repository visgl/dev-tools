/** This script gets the NPM dist tag for a given version
 *
 * Assume the current latest version is 6.1.5
 *  6.1.6 - latest
 *  6.0.7 - v6.0-latest
 *  5.3.9 - v5.3-latest
 *  6.2.0-alpha.1 - beta
 *  6.0.8-alpha.1 - v6.0-beta
 *  5.4.0-alpha.1 - v5.4-beta
 */
import {execSync} from 'child_process';
import fs from 'fs';
import {join} from 'path';
import semver from 'semver';

const {name, version} = getPackageInfo();

const tag = resolveTag();
if (tag) {
  console.log(tag);
} else {
  process.exit(1);
}

function resolveTag(): string | null {
  let track = version.includes('-') ? 'beta' : 'latest';
  let latestVersion = getPublishedVersion(name, track);

  if (!latestVersion || semver.gte(version, latestVersion)) {
    // Note we allow the equal case here in case only some packages failed to publish
    return track;
  }
  const major = semver.major(version);
  const minor = semver.minor(version);

  if (semver.major(latestVersion) === major && semver.minor(latestVersion) === minor) {
    // Within the current minor release, patch should only increment
    console.error(`INVALID VERSION ${version}, ${latestVersion} already exists`);
    return null;
  }

  track = `v${major}.${minor}-${track}`;
  latestVersion = getPublishedVersion(name, track);
  if (!latestVersion || semver.gte(version, latestVersion)) {
    // Note we allow the equal case here in case only some packages failed to publish
    return track;
  }
  // For a previous minor release, patch should only increment
  console.error(`INVALID VERSION ${version}, ${latestVersion} already exists`);
  return null;
}

function getPackageInfo(): {name: string; version: string} {
  let packageJsonFile = './package.json';
  if (fs.existsSync('./modules/core')) {
    // if the monorepo has a "core" package, use it
    packageJsonFile = './modules/core/package.json';
  } else if (fs.existsSync('./modules')) {
    // otherwise, take the first package of the monorepo
    for (const item of fs.readdirSync('./modules')) {
      const path = join('./modules', item, 'package.json');
      if (fs.existsSync(path)) {
        packageJsonFile = path;
        break;
      }
    }
  }
  return JSON.parse(fs.readFileSync(packageJsonFile, 'utf8'));
}

function getPublishedVersion(packageName: string, distTag: string): string | null {
  try {
    return execSync(`npm show ${packageName}@${distTag} version`, {
      stdio: [null, 'pipe', null],
      encoding: 'utf-8'
    }).trim();
  } catch (err) {
    // not found
    return null;
  }
}
