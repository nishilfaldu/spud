import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Clock, IdSource, IsoTime, NoteId, Title } from "@spud/core";
import { openNotes, parseIsoTime, parseNoteId, parseTitle } from "@spud/core";

function noteId(raw: string): NoteId {
	const id = parseNoteId(raw);
	if (id === undefined) {
		throw new Error(`fixture id ${raw}`);
	}
	return id;
}

function title(raw: string): Title {
	const parsed = parseTitle(raw);
	if (parsed === undefined) {
		throw new Error(`fixture title ${raw}`);
	}
	return parsed;
}

function iso(raw: string): IsoTime {
	const parsed = parseIsoTime(raw);
	if (parsed === undefined) {
		throw new Error(`fixture time ${raw}`);
	}
	return parsed;
}

function clockOf(times: readonly IsoTime[]): Clock {
	let index = 0;
	return {
		now(): IsoTime {
			const next = times[index];
			index += 1;
			if (next === undefined) {
				throw new Error("fixture clock ran out");
			}
			return next;
		},
	};
}

function idsOf(ids: readonly NoteId[]): IdSource {
	let index = 0;
	return {
		next(): NoteId {
			const id = ids[index];
			index += 1;
			if (id === undefined) {
				throw new Error("fixture ids ran out");
			}
			return id;
		},
	};
}

test("session follows the readme note flow", () => {
	const dataDir = mkdtempSync(join(tmpdir(), "spud-notes-"));
	const milkId = noteId("01JB2K3N4P5Q6R7S8T9VWXYZ0A");
	const eggsId = noteId("01JB2K3N4P5Q6R7S8T9VWXYZ1B");
	const created = iso("2026-10-28T20:31:00.000Z");
	const eggsAt = iso("2026-10-28T20:32:00.000Z");
	const editedAt = iso("2026-10-28T20:33:00.000Z");
	const repeatAt = iso("2026-10-28T20:34:00.000Z");
	const notes = openNotes({
		dataDir,
		clock: clockOf([created, eggsAt, editedAt, repeatAt]),
		ids: idsOf([milkId, eggsId]),
	});
	try {
		expect(notes.list()).toEqual([]);

		const milk = notes.create({ title: title("Milk"), body: "Buy oat milk" });
		expect(milk).toEqual({
			id: milkId,
			title: title("Milk"),
			body: "Buy oat milk",
			created,
			updated: created,
		});
		expect(Object.keys(milk)).toEqual([
			"id",
			"title",
			"body",
			"created",
			"updated",
		]);
		expect(JSON.stringify(milk, null, 2)).toBe(
			`{\n  "id": "${milkId}",\n  "title": "Milk",\n  "body": "Buy oat milk",\n  "created": "${created}",\n  "updated": "${created}"\n}`,
		);

		const eggs = notes.create({ title: title("Eggs"), body: "A dozen" });
		expect(notes.list().map((note) => note.id)).toEqual([eggs.id, milk.id]);

		const edited = notes.edit({
			id: milk.id,
			patch: { kind: "body", body: "Buy oat milk\nGet bread" },
		});
		const repeated = notes.edit({
			id: milk.id,
			patch: { kind: "body", body: "Buy oat milk\nGet bread" },
		});
		if (edited === undefined || repeated === undefined) {
			throw new Error("edit missed a stored note");
		}
		expect(edited.created).toBe(milk.created);
		expect(edited.updated).toBe(editedAt);
		expect(edited.updated).not.toBe(repeatAt);
		expect(edited.body).toBe("Buy oat milk\nGet bread");
		expect(repeated.updated).toBe(edited.updated);
		expect(repeated).toEqual(edited);

		expect(notes.search({ query: "OAT" }).map((note) => note.id)).toEqual([
			milk.id,
		]);
		expect(notes.search({ query: "%" })).toEqual([]);
		expect(notes.search({ query: "" }).map((note) => note.id)).toEqual([
			milk.id,
			eggs.id,
		]);

		expect(
			notes.show({ id: noteId("01JB2K3N4P5Q6R7S8T9VWXYZ2C") }),
		).toBeUndefined();
		const deleted = notes.rm({ id: milk.id });
		expect(deleted?.body).toBe("Buy oat milk\nGet bread");
		expect(notes.show({ id: milk.id })).toBeUndefined();
		expect(notes.rm({ id: milk.id })).toBeUndefined();
		notes.close();
		notes.close();
		expect(() => notes.list()).toThrow("notes session is closed");

		const reopened = openNotes({ dataDir });
		try {
			expect(reopened.show({ id: eggsId })?.title).toBe(title("Eggs"));
		} finally {
			reopened.close();
		}
	} finally {
		notes.close();
		rmSync(dataDir, { recursive: true, force: true });
	}
});

test("a later create mints a greater id", () => {
	const dataDir = mkdtempSync(join(tmpdir(), "spud-notes-"));
	const earlier = iso("2026-10-28T20:31:00.000Z");
	const later = iso("2026-10-28T20:32:00.000Z");
	const notes = openNotes({ dataDir, clock: clockOf([earlier, later]) });
	try {
		const milk = notes.create({ title: title("Milk"), body: "Buy oat milk" });
		const eggs = notes.create({ title: title("Eggs"), body: "A dozen" });
		expect(milk.id < eggs.id).toBe(true);
		expect(notes.list().map((note) => note.id)).toEqual([eggs.id, milk.id]);
	} finally {
		notes.close();
		rmSync(dataDir, { recursive: true, force: true });
	}
});

test("notes with the same updated sort by id descending", () => {
	const dataDir = mkdtempSync(join(tmpdir(), "spud-notes-"));
	const at = iso("2026-10-28T20:31:00.000Z");
	const low = noteId("01JB2K3N4P5Q6R7S8T9VWXYZ0A");
	const high = noteId("01JB2K3N4P5Q6R7S8T9VWXYZ1B");
	const notes = openNotes({
		dataDir,
		clock: clockOf([at, at]),
		ids: idsOf([low, high]),
	});
	try {
		notes.create({ title: title("Milk"), body: "Buy oat milk" });
		notes.create({ title: title("Eggs"), body: "A dozen" });
		expect(notes.list().map((note) => note.id)).toEqual([high, low]);
	} finally {
		notes.close();
		rmSync(dataDir, { recursive: true, force: true });
	}
});
