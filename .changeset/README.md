# Changesets

Release notes are written as changesets and compiled into `CHANGELOG.md`.

1. After making a user-facing change, run `pnpm changeset` and describe it.
2. Commit the generated file under `.changeset/` with your pull request.
3. The release workflow opens a "Version Packages" pull request that bumps the version and
   updates `CHANGELOG.md`; merging it publishes the release notes to `/changelog`.

See the [Changesets documentation](https://github.com/changesets/changesets) for details.
