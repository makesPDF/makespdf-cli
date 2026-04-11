#!/usr/bin/env node
/**
 * Local release script for @makespdf/cli.
 *
 * Flow:
 *   1. Guard the environment (clean tree, on main, up to date, pending changesets).
 *   2. Run typecheck + test + build so we never ship a broken version.
 *   3. `changeset version` — consumes pending changesets, bumps package.json,
 *      updates CHANGELOG.md.
 *   4. Commit the version bump (only package.json, CHANGELOG.md, .changeset/*).
 *   5. Prompt for confirmation — this is the last abort window. Everything so
 *      far is local-only and reversible with `git reset --hard HEAD^`.
 *   6. Push main, create annotated `vX.Y.Z` tag via `changeset tag`, push tags.
 *
 * The tag push triggers `.github/workflows/release.yml`, which mints an OIDC
 * token and publishes via `pnpm exec changeset publish --no-git-tag`.
 *
 * Usage:  pnpm release
 */

import { execSync, spawnSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const CWD = process.cwd();

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: "inherit", cwd: CWD, ...opts });
}

function capture(cmd) {
  return execSync(cmd, { cwd: CWD, encoding: "utf8" }).trim();
}

function die(msg) {
  console.error(`\nrelease: ${msg}`);
  process.exit(1);
}

function section(title) {
  console.log(`\n── ${title} ──`);
}

// ──────────────────────────────────────────────────────────────────────
// 1. Guards
// ──────────────────────────────────────────────────────────────────────
section("guards");

const branch = capture("git rev-parse --abbrev-ref HEAD");
if (branch !== "main") {
  die(`must be on main (currently on ${branch})`);
}

const dirty = capture("git status --porcelain");
if (dirty) {
  die(
    "working tree is dirty. Commit or stash your changes first:\n" +
      dirty
        .split("\n")
        .map((l) => `  ${l}`)
        .join("\n"),
  );
}

try {
  run("git fetch origin main --quiet");
} catch {
  die("couldn't fetch origin/main");
}

const behind = capture("git rev-list --count HEAD..origin/main");
if (Number(behind) > 0) {
  die(`local main is ${behind} commits behind origin/main. Run 'git pull' first.`);
}

if (!existsSync(".changeset")) {
  die(".changeset/ directory missing — run 'pnpm exec changeset init' first");
}

const pendingChangesets = readdirSync(".changeset").filter(
  (f) => f.endsWith(".md") && f !== "README.md",
);
if (pendingChangesets.length === 0) {
  die(
    "no pending changesets.\n" +
      "Run 'pnpm changeset' to describe what's changing, then try again.",
  );
}
console.log(`  ${pendingChangesets.length} pending changeset(s): ${pendingChangesets.join(", ")}`);

// ──────────────────────────────────────────────────────────────────────
// 2. Safety gate — typecheck, test, build
// ──────────────────────────────────────────────────────────────────────
section("typecheck + test + build");
run("pnpm typecheck");
run("pnpm test");
run("pnpm build");

// ──────────────────────────────────────────────────────────────────────
// 3. Consume changesets — bump package.json + CHANGELOG.md
// ──────────────────────────────────────────────────────────────────────
section("changeset version");
const oldVersion = JSON.parse(readFileSync("package.json", "utf8")).version;
run("pnpm exec changeset version");
const newVersion = JSON.parse(readFileSync("package.json", "utf8")).version;

if (oldVersion === newVersion) {
  die(
    `changeset version did not bump the version (${oldVersion}).\n` +
      "Check that your changesets declare a valid bump type (patch/minor/major).",
  );
}

console.log(`  ${oldVersion} → ${newVersion}`);

// Install to update pnpm-lock.yaml with the new version
run("pnpm install --lockfile-only");

// ──────────────────────────────────────────────────────────────────────
// 4. Commit the bump
// ──────────────────────────────────────────────────────────────────────
section(`commit: Version ${newVersion}`);
run("git add package.json CHANGELOG.md pnpm-lock.yaml .changeset");
run(`git commit -m "Version ${newVersion}"`);

// ──────────────────────────────────────────────────────────────────────
// 5. Last abort window
// ──────────────────────────────────────────────────────────────────────
section("review");
run("git --no-pager show --stat HEAD");
console.log("");
console.log("This is your last chance to abort.");
console.log("If you say no, the commit stays local and you can 'git reset --hard HEAD^' to undo.");
console.log("");

const rl = createInterface({ input, output });
const answer = (await rl.question(`Push and tag v${newVersion}? [y/N] `)).trim().toLowerCase();
rl.close();

if (answer !== "y" && answer !== "yes") {
  console.log("\naborted. The version bump commit is still local — reset with:");
  console.log("  git reset --hard HEAD^");
  process.exit(1);
}

// ──────────────────────────────────────────────────────────────────────
// 6. Push + tag
// ──────────────────────────────────────────────────────────────────────
section("push + tag");
run("git push origin main");
// `changeset tag` creates annotated vX.Y.Z tags for every bumped package.
run("pnpm exec changeset tag");
run("git push origin --tags");

console.log("");
console.log(`released v${newVersion}.`);
console.log("the tag push will trigger .github/workflows/release.yml, which publishes via OIDC.");
console.log("watch: gh run watch");
