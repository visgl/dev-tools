# ocular-publish

Publish the packages, create git tag and push.

## Usage

This script will usually be mapped to `publish`:
```bash
yarn publish [mode] [npm-tag]
```

To run it directly
```bash
npx ocular-publish [mode] [npm-tag]
```

## mode

- `beta` - bump pre-release version and publish with beta flag.
- `prod` - bump patch version and publish.
- `version-only-beta` - bump pre-release version only.
- `version-only-prod` - bump patch version only.
- `from-git`: publish from the current git tag.

## npm-tag

Custom tag for the release. If not specified, the release is tagged with `beta` if `mode: beta` and `latest` if `mode: prod`.

## Pushing the version

The version modes push the release branch and then only the tags on the version commit. They don't use `git push --tags`, which would also push any local tags missing from the remote, such as old prerelease tags or tags fetched from other repositories. GitHub doesn't create push events when more than three tags are pushed at once, so a release workflow triggered by tags would silently not run.

## Re-running a partial publish

`from-git` is safe to run again for the same tag:

- If the GitHub release for the tag already exists, it's left as is.
- In a monorepo, `lerna publish from-package` only publishes versions that aren't on npm yet. A failed attempt is retried automatically, up to 3 attempts, 120 seconds apart.
- A single package is skipped if its version is already on npm.

In the release workflow, use **Re-run failed jobs** to finish a publish that failed partway.

Known cause: `npm publish --provenance` can fail with `TLOG_CREATE_ENTRY_ERROR ... (409) an equivalent entry already exists in the transparency log`, which leaves that package unpublished ([npm/cli#10078](https://github.com/npm/cli/issues/10078)). A new attempt succeeds.

Newly published versions can take a few minutes to appear on the registry. If a retry fails only with `You cannot publish over the previously published versions`, those packages are published. Check with `npm view <package>@<version>`.
