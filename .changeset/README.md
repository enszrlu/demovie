# Changesets

Every pull request that changes what users get adds a changeset:

```bash
pnpm changeset
```

Pick `demovie` (and `@demovie/runtime` if the runtime changed), the bump type, and a one-line summary written for
users. `demovie` and `@demovie/runtime` are versioned together. The private workspace packages are bundled into
`demovie` and never published. Maintainers release through `.github/workflows/release.yml`.
