# Upstream notices

The new recipe and test code are licensed under the root MIT license. Patch context and modified upstream code retain upstream ownership and licensing.

- Bun: MIT, as stated in [its pinned license file](https://github.com/oven-sh/bun/blob/38afee6c84fcf48c0edb2466aa4b27d287a59c30/LICENSE.md). That file also lists JavaScriptCore and other linked-library licenses.
- OpenCode: MIT, Copyright (c) 2025 opencode; the full notice is retained in [licenses/opencode-MIT.txt](licenses/opencode-MIT.txt).
- JavaScriptCore/WebKit is fetched from upstream for a source build, not vendored or redistributed in this repository. No runtime binaries, link objects, package archives or sysroots are distributed here.

The recipe's MIT license does not relicense Bun's or OpenCode's dependencies. If publishing built binaries later, review the exact dependency notices and the source/relinking obligations described by upstream, including LGPL components.
