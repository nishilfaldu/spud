#!/usr/bin/env bun

import { run } from "./cli.ts";

if (import.meta.main) {
	// Bun.argv[0] is the bun binary and argv[1] is this script, so user args start at 2.
	const out = await run(Bun.argv.slice(2));
	process.stdout.write(out.stdout);
	process.stderr.write(out.stderr);
	process.exit(out.exit);
}
