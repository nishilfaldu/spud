import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { IsoTime, Note, NoteId, Title } from "../note.ts";
import {
	assembleNote,
	parseIsoTime,
	parseNoteId,
	parseTitle,
} from "../note.ts";

const NOTES_FILE = "notes.sqlite";
const WAIT_ONE_WRITE_MS = 5000;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created TEXT NOT NULL,
  updated TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS notes_recent ON notes (updated DESC, id DESC);
`;

export type NoteDb = {
	readOrdered(): readonly Note[];
	readOne(id: NoteId): Note | undefined;
	insert(note: Note): void;
	update(note: Note): void;
	delete(id: NoteId): void;
	write<T>(run: () => T): T;
	close(): void;
};

export function openDb(dataDir: string): NoteDb {
	mkdirSync(dataDir, { recursive: true });
	const database = new Database(join(dataDir, NOTES_FILE));
	database.exec(`PRAGMA busy_timeout = ${WAIT_ONE_WRITE_MS}`);
	database.exec(SCHEMA);
	const selectOrdered = database.query<unknown, []>(
		"SELECT id, title, body, created, updated FROM notes ORDER BY updated DESC, id DESC",
	);
	const selectOne = database.query<unknown, [NoteId]>(
		"SELECT id, title, body, created, updated FROM notes WHERE id = ?",
	);
	const insertNote = database.query<
		unknown,
		[NoteId, Title, string, IsoTime, IsoTime]
	>(
		"INSERT INTO notes (id, title, body, created, updated) VALUES (?, ?, ?, ?, ?)",
	);
	const updateNote = database.query<unknown, [Title, string, IsoTime, NoteId]>(
		"UPDATE notes SET title = ?, body = ?, updated = ? WHERE id = ?",
	);
	const deleteNote = database.query<unknown, [NoteId]>(
		"DELETE FROM notes WHERE id = ?",
	);
	return {
		readOrdered(): readonly Note[] {
			return selectOrdered.all().map((row) => parseNoteRow(row));
		},
		readOne(id: NoteId): Note | undefined {
			const row = selectOne.get(id);
			if (row === null) {
				return undefined;
			}
			return parseNoteRow(row);
		},
		insert(note: Note): void {
			insertNote.run(
				note.id,
				note.title,
				note.body,
				note.created,
				note.updated,
			);
		},
		update(note: Note): void {
			const result = updateNote.run(
				note.title,
				note.body,
				note.updated,
				note.id,
			);
			if (result.changes === 0) {
				throw new Error("note update missed its row");
			}
		},
		delete(id: NoteId): void {
			deleteNote.run(id);
		},
		write<T>(run: () => T): T {
			return database.transaction(run)();
		},
		close(): void {
			database.close();
		},
	};
}

function isRow(input: unknown): input is Record<string, unknown> {
	return typeof input === "object" && input !== null && !Array.isArray(input);
}

function parseNoteRow(input: unknown): Note {
	if (!isRow(input)) {
		throw new Error("corrupt note row");
	}
	const {
		id: idRaw,
		title: titleRaw,
		body,
		created: createdRaw,
		updated: updatedRaw,
	} = input;
	if (
		typeof idRaw !== "string" ||
		typeof titleRaw !== "string" ||
		typeof body !== "string" ||
		typeof createdRaw !== "string" ||
		typeof updatedRaw !== "string"
	) {
		throw new Error("corrupt note row");
	}
	const id = parseNoteId(idRaw);
	const title = parseTitle(titleRaw);
	const created = parseIsoTime(createdRaw);
	const updated = parseIsoTime(updatedRaw);
	if (
		id === undefined ||
		title === undefined ||
		created === undefined ||
		updated === undefined
	) {
		throw new Error("corrupt note row");
	}
	return assembleNote({ id, title, body, created, updated });
}
