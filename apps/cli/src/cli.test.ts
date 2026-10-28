import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CliOutput } from "./cli.ts";
import { run } from "./cli.ts";

const repoRoot = new URL("../../../", import.meta.url).pathname;

const HELP = `Usage: spud [--help] [--version]
       spud new --title <title> --body <body> [--json]
       spud list [--json]
       spud show <id> [--json]
       spud edit <id> [--title <title>] [--body <body>] [--json]
       spud rm <id> [--json]
       spud search <query> [--json]
`;

type PrintedNote = {
	readonly id: string;
	readonly title: string;
	readonly body: string;
	readonly created: string;
	readonly updated: string;
};

function spawnEnv(dataDir: string): Record<string, string> {
	const env: Record<string, string> = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (value !== undefined) {
			env[key] = value;
		}
	}
	env.SPUD_DATA_DIR = dataDir;
	return env;
}

async function spawnSpud(args: readonly string[]): Promise<CliOutput> {
	const dataDir = mkdtempSync(join(tmpdir(), "spud-spawn-"));
	try {
		const subprocess = Bun.spawn(["bunx", "spud", ...args], {
			cwd: repoRoot,
			stdout: "pipe",
			stderr: "pipe",
			env: spawnEnv(dataDir),
		});
		const stdout = await new Response(subprocess.stdout).text();
		const stderr = await new Response(subprocess.stderr).text();
		const exit = await subprocess.exited;
		if (exit !== 0 && exit !== 1 && exit !== 2) {
			throw new Error(`unexpected exit ${String(exit)}`);
		}
		return { exit, stdout, stderr };
	} finally {
		rmSync(dataDir, { recursive: true, force: true });
	}
}

async function expectSpawnMatchesRun(args: readonly string[]): Promise<void> {
	const fromRun = await run(args);
	const fromSpawn = await spawnSpud(args);
	expect(fromSpawn).toEqual(fromRun);
}

async function withDataDir(
	runCase: (dataDir: string) => Promise<void>,
): Promise<void> {
	const dataDir = mkdtempSync(join(tmpdir(), "spud-cli-"));
	const previous = process.env.SPUD_DATA_DIR;
	process.env.SPUD_DATA_DIR = dataDir;
	try {
		await runCase(dataDir);
	} finally {
		if (previous === undefined) {
			delete process.env.SPUD_DATA_DIR;
		} else {
			process.env.SPUD_DATA_DIR = previous;
		}
		rmSync(dataDir, { recursive: true, force: true });
	}
}

function readHuman(stdout: string): PrintedNote {
	const match =
		/^id ([0-9A-HJKMNP-TV-Z]{26})\ntitle (.*)\ncreated (\S+)\nupdated (\S+)\n\n([\s\S]*)\n$/.exec(
			stdout,
		);
	if (match === null) {
		throw new Error(`expected a human note, got ${JSON.stringify(stdout)}`);
	}
	const id = match[1];
	const title = match[2];
	const created = match[3];
	const updated = match[4];
	const body = match[5];
	if (
		id === undefined ||
		title === undefined ||
		created === undefined ||
		updated === undefined ||
		body === undefined
	) {
		throw new Error(`expected a human note, got ${JSON.stringify(stdout)}`);
	}
	return { id, title, body, created, updated };
}

function parseJson(stdout: string): unknown {
	const value: unknown = JSON.parse(stdout);
	return value;
}

function readNote(value: unknown): PrintedNote {
	if (typeof value !== "object" || value === null) {
		throw new Error("expected a note object");
	}
	const id = Reflect.get(value, "id");
	const title = Reflect.get(value, "title");
	const body = Reflect.get(value, "body");
	const created = Reflect.get(value, "created");
	const updated = Reflect.get(value, "updated");
	if (
		typeof id !== "string" ||
		typeof title !== "string" ||
		typeof body !== "string" ||
		typeof created !== "string" ||
		typeof updated !== "string"
	) {
		throw new Error("expected note fields to be strings");
	}
	return { id, title, body, created, updated };
}

function pretty(note: PrintedNote): string {
	return `${JSON.stringify(
		{
			id: note.id,
			title: note.title,
			body: note.body,
			created: note.created,
			updated: note.updated,
		},
		null,
		2,
	)}\n`;
}

function readNotes(value: unknown): readonly PrintedNote[] {
	if (!Array.isArray(value)) {
		throw new Error("expected a note array");
	}
	return value.map((item: unknown) => readNote(item));
}

test("--help prints usage on stdout and exits 0", async () => {
	const out = await run(["--help"]);
	expect(out).toEqual({ exit: 0, stdout: HELP, stderr: "" });
});

test("-h prints usage on stdout and exits 0", async () => {
	const out = await run(["-h"]);
	expect(out).toEqual({ exit: 0, stdout: HELP, stderr: "" });
});

test("--version prints version on stdout and exits 0", async () => {
	const out = await run(["--version"]);
	expect(out).toEqual({ exit: 0, stdout: "0.0.0\n", stderr: "" });
});

test("-v prints version on stdout and exits 0", async () => {
	const out = await run(["-v"]);
	expect(out).toEqual({ exit: 0, stdout: "0.0.0\n", stderr: "" });
});

test("empty argv prints usage on stderr and exits 2", async () => {
	const out = await run([]);
	expect(out).toEqual({ exit: 2, stdout: "", stderr: HELP });
});

test("new without flags is invalid usage", async () => {
	const out = await run(["new"]);
	expect(out).toEqual({
		exit: 2,
		stdout: "",
		stderr: "spud: new requires --title and --body\nTry 'spud --help'\n",
	});
});

test("sync and status stay unknown commands", async () => {
	for (const token of ["sync", "status"]) {
		const out = await run([token]);
		expect(out).toEqual({
			exit: 2,
			stdout: "",
			stderr: `spud: unknown command '${token}'\nTry 'spud --help'\n`,
		});
	}
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

test("a malformed id is invalid usage and does not open the store", async () => {
	await withDataDir(async (dataDir) => {
		const out = await run(["show", "not-an-id"]);
		expect(out).toEqual({
			exit: 2,
			stdout: "",
			stderr: "spud: invalid id 'not-an-id'\nTry 'spud --help'\n",
		});
		expect(existsSync(join(dataDir, "notes.sqlite"))).toBe(false);
	});
});

test("empty SPUD_DATA_DIR is invalid usage", async () => {
	const previous = process.env.SPUD_DATA_DIR;
	process.env.SPUD_DATA_DIR = "";
	try {
		const out = await run(["list"]);
		expect(out).toEqual({
			exit: 2,
			stdout: "",
			stderr: "spud: SPUD_DATA_DIR is empty\nTry 'spud --help'\n",
		});
	} finally {
		if (previous === undefined) {
			delete process.env.SPUD_DATA_DIR;
		} else {
			process.env.SPUD_DATA_DIR = previous;
		}
	}
});

test("readme tutorial strings", async () => {
	await withDataDir(async () => {
		const empty = await run(["list"]);
		expect(empty).toEqual({ exit: 0, stdout: "", stderr: "" });
		const emptyJson = await run(["list", "--json"]);
		expect(emptyJson).toEqual({ exit: 0, stdout: "[]\n", stderr: "" });

		const created = await run([
			"new",
			"--title",
			"Milk",
			"--body",
			"Buy oat milk",
		]);
		expect(created.exit).toBe(0);
		expect(created.stderr).toBe("");
		const milk = readHuman(created.stdout);
		expect(milk.title).toBe("Milk");
		expect(milk.body).toBe("Buy oat milk");
		expect(milk.created).toBe(milk.updated);

		await Bun.sleep(10);
		const eggsOut = await run([
			"new",
			"--json",
			"--title",
			"Eggs",
			"--body",
			"A dozen",
		]);
		expect(eggsOut.exit).toBe(0);
		expect(eggsOut.stderr).toBe("");
		const eggs = readNote(parseJson(eggsOut.stdout));
		expect(eggs.title).toBe("Eggs");
		expect(eggs.body).toBe("A dozen");
		expect(eggs.created).toBe(eggs.updated);
		expect(eggsOut.stdout).toBe(pretty(eggs));

		const listed = await run(["list"]);
		expect(listed).toEqual({
			exit: 0,
			stdout: `${eggs.id}  Eggs\n${milk.id}  Milk\n`,
			stderr: "",
		});
		const listedJson = await run(["list", "--json"]);
		const listedNotes = readNotes(parseJson(listedJson.stdout));
		expect(listedNotes.map((note) => note.id)).toEqual([eggs.id, milk.id]);
		expect(listedJson.stdout).toBe(
			`${JSON.stringify(
				listedNotes.map((note) => ({
					id: note.id,
					title: note.title,
					body: note.body,
					created: note.created,
					updated: note.updated,
				})),
				null,
				2,
			)}\n`,
		);

		const shown = await run(["show", milk.id]);
		expect(shown).toEqual({ exit: 0, stdout: created.stdout, stderr: "" });
		const shownJson = await run(["show", "--json", milk.id]);
		expect(shownJson.stdout).toBe(pretty(milk));

		await Bun.sleep(10);
		const edited = await run([
			"edit",
			milk.id,
			"--body",
			"Buy oat milk\nGet bread",
		]);
		const editedNote = readHuman(edited.stdout);
		expect(editedNote.created).toBe(milk.created);
		expect(editedNote.updated).not.toBe(milk.updated);
		expect(editedNote.body).toBe("Buy oat milk\nGet bread");
		expect(editedNote.title).toBe("Milk");

		await Bun.sleep(10);
		const repeated = await run([
			"edit",
			milk.id,
			"--body",
			"Buy oat milk\nGet bread",
		]);
		expect(repeated.stdout).toBe(edited.stdout);

		await Bun.sleep(10);
		const renamedOut = await run([
			"edit",
			"--json",
			eggs.id,
			"--title",
			"Farm eggs",
		]);
		const renamed = readNote(parseJson(renamedOut.stdout));
		expect(renamed.title).toBe("Farm eggs");
		expect(renamed.body).toBe("A dozen");
		expect(renamed.created).toBe(eggs.created);
		expect(renamed.updated).not.toBe(eggs.updated);
		expect(renamedOut.stdout).toBe(pretty(renamed));

		const afterEdits = await run(["list"]);
		expect(afterEdits.stdout).toBe(`${eggs.id}  Farm eggs\n${milk.id}  Milk\n`);

		const oat = await run(["search", "OAT"]);
		expect(oat).toEqual({ exit: 0, stdout: `${milk.id}  Milk\n`, stderr: "" });
		const breadOut = await run(["search", "--json", "bread"]);
		const bread = readNotes(parseJson(breadOut.stdout));
		expect(bread).toEqual([
			{
				id: milk.id,
				title: "Milk",
				body: "Buy oat milk\nGet bread",
				created: milk.created,
				updated: editedNote.updated,
			},
		]);
		expect(breadOut.stdout).toBe(
			`${JSON.stringify(
				[
					{
						id: milk.id,
						title: "Milk",
						body: "Buy oat milk\nGet bread",
						created: milk.created,
						updated: editedNote.updated,
					},
				],
				null,
				2,
			)}\n`,
		);

		const removedEggs = await run(["rm", eggs.id]);
		expect(removedEggs).toEqual({
			exit: 0,
			stdout: `deleted ${eggs.id}\n`,
			stderr: "",
		});
		const removedMilk = await run(["rm", "--json", milk.id]);
		expect(removedMilk.stdout).toBe(
			pretty({
				id: milk.id,
				title: "Milk",
				body: "Buy oat milk\nGet bread",
				created: milk.created,
				updated: editedNote.updated,
			}),
		);

		expect(await run(["list"])).toEqual({ exit: 0, stdout: "", stderr: "" });
		expect(await run(["list", "--json"])).toEqual({
			exit: 0,
			stdout: "[]\n",
			stderr: "",
		});

		const missing = await run(["show", milk.id]);
		expect(missing).toEqual({
			exit: 1,
			stdout: "",
			stderr: `spud: note not found: ${milk.id}\n`,
		});
		const missingJson = await run(["show", "--json", milk.id]);
		expect(missingJson).toEqual(missing);
		const removedAgain = await run(["rm", milk.id]);
		expect(removedAgain).toEqual(missing);
	});
});
