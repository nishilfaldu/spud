import cliPackage from "../package.json" with { type: "json" };

export type ExitCode = 0 | 1 | 2;

export type CliOutput = {
	readonly exit: ExitCode;
	readonly stdout: string;
	readonly stderr: string;
};

type Invocation =
	| { readonly kind: "help" }
	| { readonly kind: "version" }
	| { readonly kind: "usage" }
	| { readonly kind: "unknown"; readonly token: string };

const FLAGS = {
	help: ["--help", "-h"],
	version: ["--version", "-v"],
} as const;

type CliManifest = {
	readonly version: string;
	readonly bin: Readonly<Record<string, string>>;
};

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
	return { kind: "unknown", token };
}

function usage(program: string): string {
	return `Usage: ${program} [${FLAGS.help[0]}] [${FLAGS.version[0]}]\n`;
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
		default: {
			const _: never = invocation;
			return _;
		}
	}
}
