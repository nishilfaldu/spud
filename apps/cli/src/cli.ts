import { homedir } from "node:os";
import { join } from "node:path";
import type {
	CreateInput,
	EditInput,
	EditPatch,
	IdInput,
	Note,
	NoteSession,
	SearchInput,
} from "@spud/core";
import { openNotes, parseNoteId, parseTitle } from "@spud/core";
import cliPackage from "../package.json" with { type: "json" };

export type ExitCode = 0 | 1 | 2;

export type CliOutput = {
	readonly exit: ExitCode;
	readonly stdout: string;
	readonly stderr: string;
};

type Render = "text" | "json";

type CommandName = "new" | "list" | "show" | "edit" | "rm" | "search";

type Invocation =
	| { readonly kind: "help" }
	| { readonly kind: "version" }
	| { readonly kind: "usage" }
	| { readonly kind: "unknown"; readonly token: string }
	| { readonly kind: "invalid"; readonly detail: string }
	| ({ readonly kind: "new"; readonly render: Render } & CreateInput)
	| { readonly kind: "list"; readonly render: Render }
	| ({
			readonly kind: "show";
			readonly render: Render;
			readonly rawId: string;
	  } & IdInput)
	| ({
			readonly kind: "edit";
			readonly render: Render;
			readonly rawId: string;
	  } & EditInput)
	| ({
			readonly kind: "rm";
			readonly render: Render;
			readonly rawId: string;
	  } & IdInput)
	| ({ readonly kind: "search"; readonly render: Render } & SearchInput);

const FLAGS = {
	help: ["--help", "-h"],
	version: ["--version", "-v"],
} as const;

const COMMANDS = ["new", "list", "show", "edit", "rm", "search"] as const;

const USAGE_BODY = {
	new: "new --title <title> --body <body> [--json]",
	list: "list [--json]",
	show: "show <id> [--json]",
	edit: "edit <id> [--title <title>] [--body <body>] [--json]",
	rm: "rm <id> [--json]",
	search: "search <query> [--json]",
} as const satisfies Record<CommandName, string>;

type CliManifest = {
	readonly version: string;
	readonly bin: Readonly<Record<string, string>>;
};

type Scan =
	| { readonly kind: "invalid"; readonly detail: string }
	| {
			readonly kind: "ok";
			readonly render: Render;
			readonly title: string | undefined;
			readonly body: string | undefined;
			readonly positionals: readonly string[];
	  };

type DataDirResult =
	| { readonly kind: "path"; readonly path: string }
	| { readonly kind: "invalid"; readonly detail: string };

type PatchResult =
	| { readonly kind: "invalid"; readonly detail: string }
	| { readonly kind: "patch"; readonly patch: EditPatch };

type RawPatch =
	| { readonly kind: "empty" }
	| { readonly kind: "title"; readonly title: string }
	| { readonly kind: "body"; readonly body: string }
	| { readonly kind: "both"; readonly title: string; readonly body: string };

function programName(bin: CliManifest["bin"]): string {
	const names = Object.keys(bin);
	if (names.length !== 1) {
		throw new Error("apps/cli must declare exactly one bin");
	}
	const name = names[0];
	if (name === undefined) {
		throw new Error("apps/cli must declare exactly one bin");
	}
	return name;
}

function isCommand(token: string): token is CommandName {
	for (const command of COMMANDS) {
		if (command === token) {
			return true;
		}
	}
	return false;
}

function parse(args: readonly string[]): Invocation {
	const token = args[0];
	if (token === undefined) {
		return { kind: "usage" };
	}
	if (FLAGS.help.some((flag) => flag === token)) {
		return { kind: "help" };
	}
	if (FLAGS.version.some((flag) => flag === token)) {
		return { kind: "version" };
	}
	if (!isCommand(token)) {
		return { kind: "unknown", token };
	}
	const scanned = scanTail(args);
	if (scanned.kind === "invalid") {
		return scanned;
	}
	return finishCommand(token, scanned);
}

function scanTail(args: readonly string[]): Scan {
	let render: Render = "text";
	let seenJson = false;
	let title: string | undefined;
	let body: string | undefined;
	const positionals: string[] = [];
	for (let index = 1; index < args.length; index += 1) {
		const token = args[index];
		if (token === undefined) {
			break;
		}
		if (token === "--json") {
			if (seenJson) {
				return { kind: "invalid", detail: "--json was given twice" };
			}
			seenJson = true;
			render = "json";
			continue;
		}
		if (token === "--title" || token === "--body") {
			const value = args[index + 1];
			if (value === undefined || value.startsWith("-")) {
				return { kind: "invalid", detail: `${token} requires a value` };
			}
			index += 1;
			if (token === "--title") {
				if (title !== undefined) {
					return { kind: "invalid", detail: "--title was given twice" };
				}
				title = value;
				continue;
			}
			if (body !== undefined) {
				return { kind: "invalid", detail: "--body was given twice" };
			}
			body = value;
			continue;
		}
		if (token.startsWith("-")) {
			return { kind: "invalid", detail: `unknown flag '${token}'` };
		}
		positionals.push(token);
	}
	return { kind: "ok", render, title, body, positionals };
}

function finishCommand(
	command: CommandName,
	scanned: Extract<Scan, { kind: "ok" }>,
): Invocation {
	switch (command) {
		case "new":
			return finishNew(scanned);
		case "list":
			return finishList(scanned);
		case "show":
			return finishShow(scanned);
		case "edit":
			return finishEdit(scanned);
		case "rm":
			return finishRm(scanned);
		case "search":
			return finishSearch(scanned);
		default: {
			const _exhaustive: never = command;
			return _exhaustive;
		}
	}
}

function finishNew(scanned: Extract<Scan, { kind: "ok" }>): Invocation {
	const positional = scanned.positionals[0];
	if (positional !== undefined) {
		return {
			kind: "invalid",
			detail: "new does not take a positional argument",
		};
	}
	if (scanned.title === undefined || scanned.body === undefined) {
		return { kind: "invalid", detail: "new requires --title and --body" };
	}
	const title = parseTitle(scanned.title);
	if (title === undefined) {
		return { kind: "invalid", detail: "title cannot contain a line break" };
	}
	return { kind: "new", render: scanned.render, title, body: scanned.body };
}

function finishList(scanned: Extract<Scan, { kind: "ok" }>): Invocation {
	const flags = rejectTextFlags("list", scanned.title, scanned.body);
	if (flags !== undefined) {
		return { kind: "invalid", detail: flags };
	}
	const positional = scanned.positionals[0];
	if (positional !== undefined) {
		return { kind: "invalid", detail: `unexpected argument '${positional}'` };
	}
	return { kind: "list", render: scanned.render };
}

function finishShow(scanned: Extract<Scan, { kind: "ok" }>): Invocation {
	const flags = rejectTextFlags("show", scanned.title, scanned.body);
	if (flags !== undefined) {
		return { kind: "invalid", detail: flags };
	}
	const id = oneId("show", scanned.positionals);
	if (id.kind === "invalid") {
		return id;
	}
	return { kind: "show", render: scanned.render, rawId: id.rawId, id: id.id };
}

function finishRm(scanned: Extract<Scan, { kind: "ok" }>): Invocation {
	const flags = rejectTextFlags("rm", scanned.title, scanned.body);
	if (flags !== undefined) {
		return { kind: "invalid", detail: flags };
	}
	const id = oneId("rm", scanned.positionals);
	if (id.kind === "invalid") {
		return id;
	}
	return { kind: "rm", render: scanned.render, rawId: id.rawId, id: id.id };
}

function finishEdit(scanned: Extract<Scan, { kind: "ok" }>): Invocation {
	const id = oneId("edit", scanned.positionals);
	if (id.kind === "invalid") {
		return id;
	}
	const patch = buildPatch(scanned.title, scanned.body);
	if (patch.kind === "invalid") {
		return patch;
	}
	return {
		kind: "edit",
		render: scanned.render,
		rawId: id.rawId,
		id: id.id,
		patch: patch.patch,
	};
}

function finishSearch(scanned: Extract<Scan, { kind: "ok" }>): Invocation {
	const flags = rejectTextFlags("search", scanned.title, scanned.body);
	if (flags !== undefined) {
		return { kind: "invalid", detail: flags };
	}
	const query = scanned.positionals[0];
	if (query === undefined) {
		return { kind: "invalid", detail: "search requires a query" };
	}
	const extra = scanned.positionals[1];
	if (extra !== undefined) {
		return { kind: "invalid", detail: `unexpected argument '${extra}'` };
	}
	return { kind: "search", render: scanned.render, query };
}

function rejectTextFlags(
	command: "list" | "show" | "rm" | "search",
	title: string | undefined,
	body: string | undefined,
): string | undefined {
	if (title !== undefined || body !== undefined) {
		return `${command} does not take --title or --body`;
	}
	return undefined;
}

function oneId(
	command: "show" | "rm" | "edit",
	positionals: readonly string[],
):
	| { readonly kind: "invalid"; readonly detail: string }
	| {
			readonly kind: "id";
			readonly rawId: string;
			readonly id: IdInput["id"];
	  } {
	const rawId = positionals[0];
	if (rawId === undefined) {
		return { kind: "invalid", detail: `${command} requires an id` };
	}
	const extra = positionals[1];
	if (extra !== undefined) {
		return { kind: "invalid", detail: `unexpected argument '${extra}'` };
	}
	const id = parseNoteId(rawId);
	if (id === undefined) {
		return { kind: "invalid", detail: `invalid id '${rawId}'` };
	}
	return { kind: "id", rawId, id };
}

function buildPatch(
	titleRaw: string | undefined,
	body: string | undefined,
): PatchResult {
	const raw = classifyPatch(titleRaw, body);
	switch (raw.kind) {
		case "empty":
			return { kind: "invalid", detail: "edit requires --title or --body" };
		case "body":
			return { kind: "patch", patch: { kind: "body", body: raw.body } };
		case "title":
		case "both": {
			const title = parseTitle(raw.title);
			if (title === undefined) {
				return { kind: "invalid", detail: "title cannot contain a line break" };
			}
			if (raw.kind === "title") {
				return { kind: "patch", patch: { kind: "title", title } };
			}
			return { kind: "patch", patch: { kind: "both", title, body: raw.body } };
		}
		default: {
			const _exhaustive: never = raw;
			return _exhaustive;
		}
	}
}

function classifyPatch(
	title: string | undefined,
	body: string | undefined,
): RawPatch {
	if (title !== undefined && body !== undefined) {
		return { kind: "both", title, body };
	}
	if (title !== undefined) {
		return { kind: "title", title };
	}
	if (body !== undefined) {
		return { kind: "body", body };
	}
	return { kind: "empty" };
}

function usage(program: string): string {
	const head = `Usage: ${program} [${FLAGS.help[0]}] [${FLAGS.version[0]}]`;
	const lines = COMMANDS.map(
		(command) => `       ${program} ${USAGE_BODY[command]}`,
	);
	return `${[head, ...lines].join("\n")}\n`;
}

function resolveDataDir(input: {
	readonly dataDir: string | undefined;
	readonly home: string;
}): DataDirResult {
	if (input.dataDir === undefined) {
		return { kind: "path", path: join(input.home, ".spud") };
	}
	if (input.dataDir === "") {
		return { kind: "invalid", detail: "SPUD_DATA_DIR is empty" };
	}
	return { kind: "path", path: input.dataDir };
}

function renderMissing(program: string, rawId: string): CliOutput {
	return {
		exit: 1,
		stdout: "",
		stderr: `${program}: note not found: ${rawId}\n`,
	};
}

function renderInvalid(program: string, detail: string): CliOutput {
	return {
		exit: 2,
		stdout: "",
		stderr: `${program}: ${detail}\nTry '${program} --help'\n`,
	};
}

function renderNotes(render: Render, notes: readonly Note[]): CliOutput {
	switch (render) {
		case "json":
			return {
				exit: 0,
				stdout: `${JSON.stringify(notes, null, 2)}\n`,
				stderr: "",
			};
		case "text":
			return {
				exit: 0,
				stdout: notes.map((note) => `${note.id}  ${note.title}\n`).join(""),
				stderr: "",
			};
		default: {
			const _exhaustive: never = render;
			return _exhaustive;
		}
	}
}

function renderOne(
	kind: "new" | "show" | "edit" | "rm",
	render: Render,
	note: Note,
): CliOutput {
	switch (render) {
		case "json":
			return {
				exit: 0,
				stdout: `${JSON.stringify(note, null, 2)}\n`,
				stderr: "",
			};
		case "text":
			return renderOneText(kind, note);
		default: {
			const _exhaustive: never = render;
			return _exhaustive;
		}
	}
}

function renderOneText(
	kind: "new" | "show" | "edit" | "rm",
	note: Note,
): CliOutput {
	switch (kind) {
		case "rm":
			return { exit: 0, stdout: `deleted ${note.id}\n`, stderr: "" };
		case "new":
		case "show":
		case "edit":
			return {
				exit: 0,
				stdout: `id ${note.id}\ntitle ${note.title}\ncreated ${note.created}\nupdated ${note.updated}\n\n${note.body}\n`,
				stderr: "",
			};
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
	}
}

function runStored(
	program: string,
	use: (session: NoteSession) => CliOutput,
): CliOutput {
	const resolved = resolveDataDir({
		dataDir: process.env.SPUD_DATA_DIR,
		home: homedir(),
	});
	if (resolved.kind === "invalid") {
		return renderInvalid(program, resolved.detail);
	}
	const session = openNotes({ dataDir: resolved.path });
	try {
		return use(session);
	} finally {
		session.close();
	}
}

export async function run(args: readonly string[]): Promise<CliOutput> {
	const manifest: CliManifest = {
		version: cliPackage.version,
		bin: cliPackage.bin,
	};
	const program = programName(manifest.bin);
	const invocation = parse(args);
	switch (invocation.kind) {
		case "help":
			return { exit: 0, stdout: usage(program), stderr: "" };
		case "version":
			return { exit: 0, stdout: `${manifest.version}\n`, stderr: "" };
		case "usage":
			return { exit: 2, stdout: "", stderr: usage(program) };
		case "unknown":
			return {
				exit: 2,
				stdout: "",
				stderr: `${program}: unknown command '${invocation.token}'\nTry '${program} ${FLAGS.help[0]}'\n`,
			};
		case "invalid":
			return renderInvalid(program, invocation.detail);
		case "new":
			return runStored(program, (session) =>
				renderOne(
					"new",
					invocation.render,
					session.create({ title: invocation.title, body: invocation.body }),
				),
			);
		case "list":
			return runStored(program, (session) =>
				renderNotes(invocation.render, session.list()),
			);
		case "show":
			return runStored(program, (session) => {
				const note = session.show({ id: invocation.id });
				if (note === undefined) {
					return renderMissing(program, invocation.rawId);
				}
				return renderOne("show", invocation.render, note);
			});
		case "edit":
			return runStored(program, (session) => {
				const note = session.edit({
					id: invocation.id,
					patch: invocation.patch,
				});
				if (note === undefined) {
					return renderMissing(program, invocation.rawId);
				}
				return renderOne("edit", invocation.render, note);
			});
		case "rm":
			return runStored(program, (session) => {
				const note = session.rm({ id: invocation.id });
				if (note === undefined) {
					return renderMissing(program, invocation.rawId);
				}
				return renderOne("rm", invocation.render, note);
			});
		case "search":
			return runStored(program, (session) =>
				renderNotes(
					invocation.render,
					session.search({ query: invocation.query }),
				),
			);
		default: {
			const _exhaustive: never = invocation;
			return _exhaustive;
		}
	}
}
