# vis.gl dev-tools

This is a monorepo for development tools primarily designed for building vis.gl's Javascript frameworks.

It currently contains:

- `@vis.gl/dev-tools` - Dev tools (build, lint, test, publish)
- `@vis.gl/ts-plugins` - TypeScript plugins

## GitHub merge queue

The `test` workflow validates pull requests, `merge_group` commits, and pushes to `master`.
Its `test` job runs the same build, lint, Node/browser tests, and coverage checks for each event.

After the workflow change lands, repository administrators can enable the merge queue for
`master` and require the `test` job from the `test` workflow (GitHub Actions). Any additional
required status check must also report on merge-group commits, or queued merges will wait
for a check that never runs. Queue settings are configured in GitHub, not by this workflow.

See [GitHub's merge queue configuration guide](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue).
