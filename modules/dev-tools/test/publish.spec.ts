import {afterEach, expect, test} from 'vitest';
import {execFileSync, spawnSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const publishScript = fileURLToPath(new URL('../scripts/publish.sh', import.meta.url));
const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, {recursive: true, force: true});
  }
});

function setup() {
  const cwd = mkdtempSync(join(tmpdir(), 'ocular-publish-'));
  directories.push(cwd);
  const bin = join(cwd, 'bin');
  mkdirSync(bin);
  mkdirSync(join(cwd, 'modules', 'example'), {recursive: true});
  const manifest = join(cwd, 'modules', 'example', 'package.json');
  const original = '{"name":"example","version":"1.0.0"}\n';
  writeFileSync(manifest, original);
  writeFileSync(join(cwd, 'package.json'), '{"private":true}\n');
  writeFileSync(join(cwd, 'README.md'), 'original\n');
  const git = (...args: string[]) => execFileSync('git', args, {cwd, encoding: 'utf8'});
  git('init', '--quiet');
  git('add', '.');
  git(
    '-c',
    'user.name=Test',
    '-c',
    'user.email=test@example.com',
    'commit',
    '--quiet',
    '-m',
    'initial'
  );
  const mock = (name: string, source: string) =>
    writeFileSync(join(bin, name), `#!/bin/bash\nset -e\n${source}\n`, {mode: 0o755});
  // Avoid GitHub, npm and real delays while exercising the actual publish shell script.
  mock('node', 'echo beta');
  mock('sleep', 'echo "$1" >> delays');
  mock(
    'npx',
    `git diff --exit-code --quiet || exit 99
count=0
if [ -f attempts ]; then count=$(cat attempts); fi
count=$((count + 1))
echo "$count" > attempts
if [ "$count" -le "\${FAILURES:-1}" ]; then
  echo '{"name":"example","version":"1.0.0","gitHead":"generated"}' > modules/example/package.json
  echo '{"private":true,"gitHead":"generated"}' > package.json
  if [ "\${CHANGE_OTHER:-}" = 1 ]; then echo changed > README.md; fi
  exit 1
fi`
  );
  const run = (env: Record<string, string> = {}) =>
    spawnSync('bash', [publishScript, 'from-git'], {
      cwd,
      encoding: 'utf8',
      env: {...process.env, PATH: `${bin}:${process.env.PATH}`, ...env}
    });
  return {cwd, manifest, original, git, run};
}

test('publish retries with clean manifests after a partial failure', () => {
  const {cwd, manifest, original, git, run} = setup();
  const result = run();
  expect(result.status, result.stderr).toBe(0);
  expect(readFileSync(join(cwd, 'attempts'), 'utf8')).toBe('2\n');
  expect(readFileSync(join(cwd, 'delays'), 'utf8')).toBe('120\n');
  expect(readFileSync(manifest, 'utf8')).toBe(original);
  expect(git('diff')).toBe('');
});

test('publish restores manifests after exhausting retries', () => {
  const {cwd, manifest, original, run} = setup();
  const result = run({FAILURES: '3'});
  expect(result.status).toBe(1);
  expect(result.stdout).toContain('failed to publish after 3 attempts');
  expect(readFileSync(join(cwd, 'attempts'), 'utf8')).toBe('3\n');
  expect(readFileSync(join(cwd, 'delays'), 'utf8')).toBe('120\n120\n');
  expect(readFileSync(manifest, 'utf8')).toBe(original);
});

test('publish cleanup does not revert changes to other files', () => {
  const {cwd, manifest, original, run} = setup();
  const result = run({CHANGE_OTHER: '1'});
  expect(result.status).toBe(1);
  expect(readFileSync(manifest, 'utf8')).toBe(original);
  expect(readFileSync(join(cwd, 'README.md'), 'utf8')).toBe('changed\n');
});

test.each([false, true])('publish preserves pre-existing edits (staged: %s)', (staged) => {
  const {manifest, git, run} = setup();
  writeFileSync(manifest, 'user changes\n');
  if (staged) git('add', 'modules/example/package.json');
  const before = git('status', '--porcelain');
  const result = run();
  expect(result.status).toBe(1);
  expect(result.stdout).toContain('Working tree has uncommitted changes');
  expect(readFileSync(manifest, 'utf8')).toBe('user changes\n');
  expect(git('status', '--porcelain')).toBe(before);
});
