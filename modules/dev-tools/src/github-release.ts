// This script is designed to work with automated release workflow
// Requires env var GITHUB_TOKEN
// See https://github.com/visgl/.github/blob/main/workflow-templates/release.yml
import {execSync} from 'child_process';
import {readFileSync} from 'fs';

/** GitHub token with release access */
const token = process.env.GITHUB_TOKEN;
if (!token) {
  // Do not proceed if publish token is not provided
  console.warn('Environment variable GITHUB_TOKEN not found, skipping release');
  process.exit(0);
}

/** GitHub repo path, e.g. visgl/deck.gl */
const repository = getRepoName();
if (!repository) {
  // Do not proceed if repository is not defined
  console.warn('repository.url not defined in package.json, skipping release');
  process.exit(0);
}

/** Version tag, e.g. v1.0.0 */
const tag = getGitTag();
if (!tag) {
  console.error('TAG NOT FOUND');
  process.exit(1);
}

/** Description of this release, parsed from CHANGELOG.md */
const releaseNotes = getReleaseNotes(tag);
if (!releaseNotes) {
  console.error('CHANGELOG NOT FOUND');
  process.exit(1);
}

createRelease();

async function createRelease() {
  // Publish release notes to GitHub
  // https://docs.github.com/en/rest/reference/repos#create-a-release
  const url = `https://api.github.com/repos/${repository}/releases`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json'
    },
    body: JSON.stringify({
      tag_name: tag,
      name: tag,
      body: releaseNotes,
      prerelease: tag!.search(/alpha|beta|rc/) > 0
    })
  });
  if (!resp.ok) {
    let reason: string = `POST to ${url} failed with code ${resp.status}`;
    try {
      const details = await resp.text();
      reason += `\n${details}`;
    } catch {
      // ignore
    }
    throw new Error(reason);
  }
  console.log(`Release created: https://github.com/${repository}/releases/tag/${tag}`);
}

function getRepoName(): string | null {
  const packageInfo = JSON.parse(readFileSync('package.json', 'utf-8'));
  const repoUrl = packageInfo.repository?.url as string;
  if (!repoUrl || !repoUrl.includes('github.com')) {
    return null;
  }
  const m = repoUrl.match(/([\w\.\-]+\/[\w\.\-]+?)(.git)?$/);
  return m?.[1] ?? null;
}

function getGitTag(): string | null {
  try {
    return execSync('git describe --tags --exact-match HEAD', {
      stdio: [null, 'pipe', null],
      encoding: 'utf-8'
    }).trim();
  } catch (err) {
    // not tagged
    return null;
  }
}

function getReleaseNotes(version: string): string | null {
  let changelog = readFileSync('CHANGELOG.md', 'utf-8');
  const header = changelog.match(new RegExp(`^###.*\\b${version.replace('v', '')}\\b.*$`, 'm'));
  if (!header) {
    return null;
  }
  changelog = changelog.slice(header.index! + header[0].length);
  const endIndex = changelog.search(/^#/m);
  if (endIndex > 0) {
    changelog = changelog.slice(0, endIndex);
  }
  return changelog.trim();
}
