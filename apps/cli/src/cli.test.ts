import { expect, test } from "bun:test";
import type { CliOutput } from "./cli.ts";
import { run } from "./cli.ts";

const repoRoot = new URL("../../../", import.meta.url).pathname;

async function spawnSpud(args: readonly string[]): Promise<CliOutput> {
	const subprocess = Bun.spawn(["bunx", "spud", ...args], {
		cwd: repoRoot,
		stdout: "pipe",
		stderr: "pipe",
	});
	const stdout = await new Response(subprocess.stdout).text();
	const stderr = await new Response(subprocess.stderr).text();
	const exit = await subprocess.exited;
	if (exit !== 0 && exit !== 1 && exit !== 2) {
		throw new Error(`unexpected exit ${String(exit)}`);
	}
	return { exit, stdout, stderr };
}

async function expectSpawnMatchesRun(args: readonly string[]): Promise<void> {
	const fromRun = await run(args);
	const fromSpawn = await spawnSpud(args);
	expect(fromSpawn).toEqual(fromRun);
}

test("--help prints usage on stdout and exits 0", async () => {
	const out = await run(["--help"]);
	expect(out.exit).toBe(0);
	expect(out.stdout).toContain("Usage:");
	expect(out.stderr).toBe("");
});

test("-h prints usage on stdout and exits 0", async () => {
	const out = await run(["-h"]);
	expect(out.exit).toBe(0);
	expect(out.stdout).toContain("Usage:");
	expect(out.stderr).toBe("");
});

test("--version prints version on stdout and exits 0", async () => {
	const out = await run(["--version"]);
	expect(out.exit).toBe(0);
	expect(out.stdout).toBe("0.0.0\n");
	expect(out.stderr).toBe("");
});

test("-v prints version on stdout and exits 0", async () => {
	const out = await run(["-v"]);
	expect(out.exit).toBe(0);
	expect(out.stdout).toBe("0.0.0\n");
	expect(out.stderr).toBe("");
});

test("empty argv prints usage on stderr and exits 2", async () => {
	const out = await run([]);
	expect(out.exit).toBe(2);
	expect(out.stdout).toBe("");
	expect(out.stderr).toContain("Usage:");
});

test("unknown first token mentions the token and --help, exits 2", async () => {
	const out = await run(["new"]);
	expect(out.exit).toBe(2);
	expect(out.stdout).toBe("");
	expect(out.stderr).toContain("new");
	expect(out.stderr).toContain("--help");
});

test("bunx spud with no args matches run([])", async () => {
	await expectSpawnMatchesRun([]);
});

test("bunx spud --help matches run([--help])", async () => {
	await expectSpawnMatchesRun(["--help"]);
});

test("bunx spud new matches run([new])", async () => {
	await expectSpawnMatchesRun(["new"]);
});
