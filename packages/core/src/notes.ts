import type { NoteDb } from "./internal/db.ts";
import { openDb } from "./internal/db.ts";
import type {
	CreateInput,
	EditInput,
	EditPatch,
	IdInput,
	IsoTime,
	Note,
	NoteId,
	SearchInput,
	Title,
} from "./note.ts";
import { assembleNote, parseIsoTime, parseNoteId } from "./note.ts";

export type Clock = {
	now(): IsoTime;
};

export type IdSource = {
	next(now: IsoTime): NoteId;
};

export type OpenNotes = {
	readonly dataDir: string;
	readonly clock?: Clock;
	readonly ids?: IdSource;
};

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const TIME_PREFIX_LIMIT_MS = 2 ** 48;

const systemClock: Clock = {
	now(): IsoTime {
		const parsed = parseIsoTime(new Date().toISOString());
		if (parsed === undefined) {
			throw new Error("system clock did not produce an IsoTime");
		}
		return parsed;
	},
};

const randomIds: IdSource = {
	next(now: IsoTime): NoteId {
		return mintTimePrefixedNoteId(
			now,
			crypto.getRandomValues(new Uint8Array(10)),
		);
	},
};

export class NoteSession {
	#database: NoteDb | undefined;
	readonly #clock: Clock;
	readonly #ids: IdSource;

	private constructor(database: NoteDb, clock: Clock, ids: IdSource) {
		this.#database = database;
		this.#clock = clock;
		this.#ids = ids;
	}

	static open(database: NoteDb, clock: Clock, ids: IdSource): NoteSession {
		return new NoteSession(database, clock, ids);
	}

	create(input: CreateInput): Note {
		const now = this.#clock.now();
		const id = this.#ids.next(now);
		const note = assembleNote({
			id,
			title: input.title,
			body: input.body,
			created: now,
			updated: now,
		});
		this.#store().write(() => {
			this.#store().insert(note);
		});
		return note;
	}

	list(): readonly Note[] {
		return this.#store().readOrdered();
	}

	show(input: IdInput): Note | undefined {
		return this.#store().readOne(input.id);
	}

	edit(input: EditInput): Note | undefined {
		return this.#store().write(() => {
			const stored = this.#store().readOne(input.id);
			if (stored === undefined) {
				return undefined;
			}
			const next = nextNote(stored, input.patch, this.#clock.now());
			if (next === stored) {
				return stored;
			}
			this.#store().update(next);
			return next;
		});
	}

	rm(input: IdInput): Note | undefined {
		return this.#store().write(() => {
			const stored = this.#store().readOne(input.id);
			if (stored === undefined) {
				return undefined;
			}
			this.#store().delete(input.id);
			return stored;
		});
	}

	search(input: SearchInput): readonly Note[] {
		return this.#store()
			.readOrdered()
			.filter((note) => textHas(note, input.query));
	}

	close(): void {
		const database = this.#database;
		if (database === undefined) {
			return;
		}
		database.close();
		this.#database = undefined;
	}

	#store(): NoteDb {
		const database = this.#database;
		if (database === undefined) {
			throw new Error("notes session is closed");
		}
		return database;
	}
}

export function openNotes(options: OpenNotes): NoteSession {
	const clock = options.clock ?? systemClock;
	const ids = options.ids ?? randomIds;
	return NoteSession.open(openDb(options.dataDir), clock, ids);
}

function nextNote(note: Note, patch: EditPatch, now: IsoTime): Note {
	switch (patch.kind) {
		case "title":
			return noteWithText(note, patch.title, note.body, now);
		case "body":
			return noteWithText(note, note.title, patch.body, now);
		case "both":
			return noteWithText(note, patch.title, patch.body, now);
		default: {
			const _exhaustive: never = patch;
			return _exhaustive;
		}
	}
}

function noteWithText(
	note: Note,
	title: Title,
	body: string,
	now: IsoTime,
): Note {
	if (title === note.title && body === note.body) {
		return note;
	}
	return assembleNote({
		id: note.id,
		title,
		body,
		created: note.created,
		updated: now,
	});
}

function textHas(note: Note, query: string): boolean {
	const needle = query.toLowerCase();
	return (
		note.title.toLowerCase().includes(needle) ||
		note.body.toLowerCase().includes(needle)
	);
}

function mintTimePrefixedNoteId(now: IsoTime, entropy: Uint8Array): NoteId {
	if (entropy.length !== 10) {
		throw new Error("note id entropy must be 10 bytes");
	}
	const encoded = `${encodeTime(unixMs(now))}${encodeEntropy(entropy)}`;
	const id = parseNoteId(encoded);
	if (id === undefined) {
		throw new Error("minted note id is not a NoteId");
	}
	return id;
}

function unixMs(now: IsoTime): number {
	const ms = Date.parse(now);
	if (!Number.isInteger(ms) || ms < 0 || ms >= TIME_PREFIX_LIMIT_MS) {
		throw new Error("note id time is out of range");
	}
	return ms;
}

function encodeTime(ms: number): string {
	let time = ms;
	let encoded = "";
	for (let index = 0; index < 10; index += 1) {
		encoded = CROCKFORD.charAt(time % 32) + encoded;
		time = Math.floor(time / 32);
	}
	return encoded;
}

function encodeEntropy(entropy: Uint8Array): string {
	let buffer = 0;
	let bits = 0;
	let encoded = "";
	for (const byte of entropy) {
		buffer = (buffer << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			bits -= 5;
			encoded += CROCKFORD.charAt((buffer >> bits) & 31);
			buffer &= (1 << bits) - 1;
		}
	}
	return encoded;
}
