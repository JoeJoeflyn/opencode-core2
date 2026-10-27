# OpenCode on Core 2 / Penryn

A hardware-tested workaround for Bun/OpenCode startup crashes on a CPU without SSE4.2 or POPCNT. **Unofficial, Linux CLI/TUI only.** This is a small patch/recipe repository, not a full Bun or OpenCode fork. No binaries or account data are included.

## What worked

Tested on a MacBookAir3,1 with Intel Core 2 Duo U9400, running **Alpine Linux 3.24.3** (not macOS). This CPU has SSE4.1 but lacks SSE4.2, POPCNT and AVX.

Stock Bun 1.4.4 musl crashed before `bun --version`; GDB stopped at `popcnt %r12,%r13`. Rebuilding **Bun and its pinned JavaScriptCore for Penryn**, then embedding that runtime in OpenCode 2.1.2, worked on the actual machine.

Verified: Bun startup, Unicode, crypto/hash vectors, compression, JS JIT, WASM population count, SQLite, HTTP, subprocesses, and the real OpenCode TUI. Two actual DeepSeek V4.1 Flash Free conversations completed, including one with the installed command and original profile. Acceptance used a real PTY and checked the completed assistant record; this was not a desktop GUI test. No CPU emulation or remote execution backend was used.

**Scope:** Penryn requires SSE4.1. This is not verified for older Core 2 CPUs without SSE4.1, AMD Phenom/Athlon, Windows, macOS, desktop packaging, or Linux Mint/glibc. A Linux Mint user needs a separately built/tested glibc runtime or a suitable Alpine/musl environment; the Alpine build is not a drop-in Mint binary. Not every SIGILL has this cause—inspect the faulting instruction first.

## Patches

- [`patches/bun.patch`](patches/bun.patch): opt-in `BUN_CORE2_BUILD=1` changes the Linux x64 CPU target from Nehalem to Penryn. The shared flag table also supplies Rust's CPU target and local WebKit's target. The patch also preserves the musl target/sysroot when configuring local WebKit.
- [`patches/opencode.patch`](patches/opencode.patch): lets the build use `BUN_COMPILE_EXECUTABLE_PATH` rather than embedding a stock runtime.

Rebuilding only OpenCode with stock Bun, or rebuilding Bun while linking stock prebuilt JavaScriptCore, is insufficient. Runtime CPU checks were not bypassed. No provider, account, client-identity or quota logic was patched. The previous HTTP 429's exact server-side cause remains unknown; this is not a quota bypass or a promise of future free-model availability.

## Build the tested revisions

Use a faster **x86-64 build host** with a working build-time Bun, LLVM **23.1.1**, Rust **nightly-2026-09-15** with `rust-src` and the `x86_64-unknown-linux-musl` target, CMake, Ninja, Ruby, Perl, NASM and upstream's other build prerequisites. For OpenCode bytecode generation, use build-time **Bun 1.4.4**, matching the custom runtime.

Prepare an **Alpine/musl sysroot with its C/C++ development libraries and ICU headers/libraries**. The tested system used Alpine 3.24.3 and ICU 78.1; set `LINUX_MUSL_SYSROOT` to your extracted root. A complete clean sysroot bootstrap is not automated here. Do not copy an account/home directory into it. Official LLVM Linux binaries may need host ICU70 libraries; keep those separate from the target ICU78 sysroot. See [Bun's build prerequisites](https://bun.com/docs/project/development).

```bash
# Start in this recipe repository.
export RECIPE="$PWD"
export WORK="$HOME/opencode-core2-work"
mkdir -p "$WORK"
git clone --depth 1 --branch bun-v1.4.4 https://github.com/oven-sh/bun.git "$WORK/bun"
git clone --depth 1 --branch v2.1.2 https://github.com/anomalyco/opencode.git "$WORK/opencode"

git -C "$WORK/bun" apply "$RECIPE/patches/bun.patch"
git -C "$WORK/opencode" apply "$RECIPE/patches/opencode.patch"

mkdir -p "$WORK/bun/vendor/WebKit"
git -C "$WORK/bun/vendor/WebKit" init
git -C "$WORK/bun/vendor/WebKit" fetch --depth 1 https://github.com/oven-sh/WebKit.git d6375c72affe0f70222cdcb45012b10f0bf3a9d5
git -C "$WORK/bun/vendor/WebKit" checkout --detach FETCH_HEAD

# Set these to your matching toolchain/sysroot, not the literal examples.
export BUN_TOOLCHAIN_LLVM=/absolute/path/to/llvm-23.1.1
export LINUX_MUSL_SYSROOT=/absolute/path/to/alpine-sysroot
export RUSTUP_TOOLCHAIN=nightly-2026-09-15
export BUN_CORE2_BUILD=1
export BUN_BUILD_CACHE_DIR="$WORK/cache"
export PKG_CONFIG_SYSROOT_DIR="$LINUX_MUSL_SYSROOT"
export PKG_CONFIG_LIBDIR="$LINUX_MUSL_SYSROOT/usr/lib/pkgconfig"
export CMAKE_BUILD_PARALLEL_LEVEL=2

cd "$WORK/bun"
bun install --frozen-lockfile
bun scripts/build.ts --profile=release-local --abi=musl --arch=x64 --build-dir=build/core2-musl -j2

# The cross-built binary need not execute on the build host.
cd "$WORK/opencode"
bun install --frozen-lockfile --ignore-scripts
OPENCODE_VERSION=2.1.2 \
BUN_COMPILE_EXECUTABLE_PATH="$WORK/bun/build/core2-musl/bun" \
bun packages/cli/script/build.ts --target=opencode-linux-x64-musl \
  --skip-install --skip-web-ui --outdir="$WORK/opencode-dist"
```

Expected revisions: Bun `38afee6c84fcf48c0edb2466aa4b27d287a59c30`; OpenCode `a517687fde98a7329ada3ae644a01a9fc6c4e99e`. Output: `bun/build/core2-musl/bun` and `opencode-dist/cli-linux-x64-musl/bin/opencode`. The OpenCode build intentionally omits the embedded browser UI, not the TUI.

These commands mirror the successful pinned build with portable paths. Prerequisite installation and other host/target combinations need separate validation. Do not build in a directory containing unrelated uncommitted work or run concurrent builds in one build directory.

## Verify and install safely

1. Copy the custom binaries to a temporary directory on the **target machine**. Check their actual ELF dependencies; the tested target already had musl and ICU78 installed. Do not fake a missing library by symlinking incompatible ICU versions.
2. With core dumps disabled (`ulimit -c 0`), run the custom `bun --version` and `bun /absolute/path/to/tests/runtime-smoke.mjs` from an empty temporary HOME/XDG profile. This test starts only a loopback HTTP server and makes no provider request.
3. Run the custom `opencode --version`, then its normal interactive TUI with `--standalone` in an isolated profile. No need to run an OpenCode server on the build host.
4. Back up your existing database/config/state locally before testing your real account. Verify an actual completed reply in the TUI—not just version output or a one-line probe. Never post credentials, databases, raw authenticated traces or core dumps.
5. Only then switch your launcher to the compatible binary. Retain the original launcher and a private rollback snapshot. Disable automatic OpenCode updates with `OPENCODE_DISABLE_AUTOUPDATE=1`; stock updates may restore the unsupported runtime. Do not use stock `bun upgrade` on this CPU.

The matching build passed native binary export/dependency/hardening checks. Only this physical target and pinned version pair have been validated, not the full Bun/OpenCode test matrices.

## Related reports

- [OpenCode #59582: Core 2 Quad Q9650, Linux Mint, requesting a recompilation guide](https://github.com/anomalyco/opencode/issues/59582) — closest CPU match, different libc and desktop packaging.
- [OpenCode #59461: missing SSE4.2 on Windows/AMD](https://github.com/anomalyco/opencode/issues/59461) — related limitation, **not** a verified target for this Penryn/Linux recipe.
- [OpenCode #59522: desktop server terminated by SIGILL](https://github.com/anomalyco/opencode/issues/59522) — related symptom, insufficient CPU evidence to assert the identical mechanism.
- [Bun #7179: baseline build fails at startup without SSE4.2](https://github.com/oven-sh/bun/issues/7179).
- [Official Bun CPU requirements](https://bun.com/docs/installation#cpu-requirements) — current x64 builds target Nehalem/SSE4.2; baseline assets are compatibility aliases, not a pre-Nehalem build.

Recipe and patches were prepared with AI assistance and validated on physical hardware. This is a community workaround, not an upstream support commitment. New files are MIT licensed; upstream patch excerpts retain their original licenses. See [NOTICE.md](NOTICE.md). No prebuilt executables are distributed here; binary distribution would require reviewing all linked-library notices and applicable relinking/source obligations.
