# DSH-plugin-devTools

Developer tools for the [DeepSeek Harness](https://github.com/deepseek-ai) DSH
Web GUI.

This repository is a plugin market index: it holds the plugin sources and a
format-1 market index that the Harness reads on the **Plugins** page's
**Discover** tab.

## Installing from this repository

Add the index under **Plugins** > **Custom plugin indexes**:

```
https://raw.githubusercontent.com/Thomas1yang/DSH-plugin-devTools/main/market-index.json
```

The Discover tab then lists every plugin here with its version, description,
and icon, and installs the exact commit the index names.

## Plugins

| Plugin | Description |
|---|---|
| [dsh-toolbox](dsh-toolbox/) | A toolbox panel in the sidebar: a card grid of formatters, today a JSON formatter and an XML formatter. |

## Layout

| Path | Role |
|---|---|
| `market-index.json` | The format-1 index document the Discover tab reads. |
| `<plugin>/` | One plugin package per directory. |
| `<plugin>/build-market-index.mjs` | Regenerates the root index from the repository's own state and validates it. |
| `<plugin>/PUBLISHING.md` | How to release a new version of that plugin. |
| `<plugin>/serve-local.sh` | Serves the index and the repository from this machine, for use before a push. |

## Adding a plugin

1. Create `<plugin-name>/` with a `package.json` that declares `dsh.bundle.patch`
   and, for a browser plugin, `dsh.client`.
2. Add a `build-market-index.mjs` that reads the repository's own state and
   writes the root `market-index.json`. The Toolbox script is a worked
   example; it names the plugin's directory in the version's `path` and
   validates the result with `@deepseek-ai/dsh-plugin-market-index` before
   writing it.
3. Add the plugin to the index document and commit both.

## Releasing

Each plugin's `publish.sh` pushes the repository, regenerates the index so it
names the pushed commit, and pushes the index too:

```sh
cd <plugin-name>
./publish.sh
```

See `READING-THE-INDEX.md` for how to read the index before the repository is
published, and `dsh-toolbox/PUBLISHING.md` for the release details.

## Notes

- The index is unsigned: its contents are its own claim, and the installed
  manifest decides what is actually installed.
- Every version pins one commit, so a published version never changes under an
  installer.
