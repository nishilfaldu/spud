import { expect, test } from "bun:test";
import * as core from "@spud/core";
import {
	isIsoTime,
	isNoteId,
	isTitle,
	parseIsoTime,
	parseNoteId,
	parseTitle,
} from "@spud/core";

const PUBLIC_KEYS = [
	"NoteSession",
	"isIsoTime",
	"isNoteId",
	"isTitle",
	"openNotes",
	"parseIsoTime",
	"parseNoteId",
	"parseTitle",
];

test("public barrel exports the note api", () => {
	expect(Object.keys(core).sort()).toEqual(PUBLIC_KEYS);
});

test("parseNoteId uppercases a crockford id and rejects anything else", () => {
	const lower = "01jb2k3n4p5q6r7s8t9vwxyz0a";
	expect(parseNoteId(lower) === "01JB2K3N4P5Q6R7S8T9VWXYZ0A").toBe(true);
	expect(isNoteId(lower)).toBe(false);
	expect(isNoteId("01JB2K3N4P5Q6R7S8T9VWXYZ0A")).toBe(true);
	expect(parseNoteId("not-an-id")).toBeUndefined();
	expect(parseNoteId("01JB2K3N4P5Q6R7S8T9VWXYZOI")).toBeUndefined();
});

test("parseTitle rejects CR and LF and keeps an empty title", () => {
	expect(parseTitle("Milk") === "Milk").toBe(true);
	expect(isTitle("Milk")).toBe(true);
	expect(parseTitle("") === "").toBe(true);
	expect(parseTitle("a\nb")).toBeUndefined();
	expect(parseTitle("a\rb")).toBeUndefined();
});

test("parseIsoTime requires a UTC millisecond timestamp that round-trips", () => {
	expect(
		parseIsoTime("2026-10-28T20:31:00.000Z") === "2026-10-28T20:31:00.000Z",
	).toBe(true);
	expect(isIsoTime("2026-10-28T20:31:00.000Z")).toBe(true);
	expect(parseIsoTime("2026-13-01T00:00:00.000Z")).toBeUndefined();
	expect(parseIsoTime("2026-10-28T20:31:00.000+00:00")).toBeUndefined();
});
