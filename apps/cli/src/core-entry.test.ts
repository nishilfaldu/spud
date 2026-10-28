import { expect, test } from "bun:test";
import * as core from "@spud/core";
import cliPackage from "../package.json" with { type: "json" };

test("core public barrel exports the note api", () => {
	expect(Object.keys(core).sort()).toEqual([
		"NoteSession",
		"isIsoTime",
		"isNoteId",
		"isTitle",
		"openNotes",
		"parseIsoTime",
		"parseNoteId",
		"parseTitle",
	]);
});

test("cli depends on @spud/core via workspace:*", () => {
	expect(cliPackage.dependencies["@spud/core"]).toBe("workspace:*");
});
