# Development

## Adding a provider

Providers are adapters. One file, one interface, one line in a registry. No switch to hunt down.

A voice provider in `lib/voice/`:

```js
module.exports = {
    name: 'myprovider',                    // the value of voice.provider
    async setup(c) { return { /* … */ }; }, // validate + resolve, before anything renders
    async synth(v, text, outBase) { return '/path/to/audio'; }, // or null for no narration
};
```

A music provider in `lib/music/`:

```js
module.exports = {
    name: 'myprovider',                    // the value of music.provider
    setup(c) { return { /* … */ }; },
    async source(m, { ff, workDir, tmp, seconds }) { return '/path/to/bed'; }, // or null
};
```

Then add the `require` to `PROVIDERS` in that folder's `index.cjs`, and the name to the enum in
`lib/validate.cjs`. Providers return a raw bed; looping, trimming, ducking and fading are shared.

## The skill folder

`SKILL.md` is the workflow around the tool: how to decide what goes in a report, what
belongs on the closing card instead of in a shot, and the judgement calls this CLI cannot make
for you. The CLI is the how; that file is the why.

It is written as a [Claude Code](https://claude.com/claude-code) skill, so an agent can load it
and run the whole cycle. It reads fine as plain Markdown if you do not use Claude. It is not
shipped in the npm package.

To use it as a skill, symlink it (which keeps it version-controlled here rather than only in
your home directory):

```bash
mkdir -p ~/.claude/skills/newsreel
ln -s "$PWD/SKILL.md" ~/.claude/skills/newsreel/SKILL.md
```

## Releasing

Publishing runs from CI through **trusted publishing (OIDC)**. There is no npm token in a
secret anywhere: GitHub mints a short-lived OIDC token, npm exchanges it for publish rights
scoped to this repository and this workflow file, and the release carries a provenance
attestation naming the commit and the run that built it.

```bash
npm version patch      # or minor / major: bumps package.json and tags
git push --follow-tags # the tag triggers .github/workflows/release.yml
```

The workflow refuses to publish if the tag disagrees with `package.json`, if the tests fail,
or if the packed tarball has lost the scene bundles or the harness. That last check exists
because a package missing `visuals/` still looks fine on disk and 404s every generated scene
on an installed copy.

One-time setup, on npmjs.com under the package's **Settings -> Trusted publisher**: GitHub
Actions, owner `e3o8o`, repository `newsreel`, workflow filename `release.yml`.
