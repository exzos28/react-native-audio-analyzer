# Changesets

Every pull request that changes the published package should include a
changeset describing the change for the changelog:

```sh
yarn changeset
```

Pick the bump type (`patch` for fixes, `minor` for new features, `major` for
breaking changes) and write a short, user-facing summary. On merge to `main`,
the Release workflow opens a "chore: version packages" pull request; merging
that pull request publishes the new version to npm.

See the [changesets docs](https://github.com/changesets/changesets) for more.
