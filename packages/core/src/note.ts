export type NoteId = string & { readonly __brand: "NoteId" };
export type Title = string & { readonly __brand: "Title" };
export type IsoTime = string & { readonly __brand: "IsoTime" };

export type Note = {
	readonly id: NoteId;
	readonly title: Title;
	readonly body: string;
	readonly created: IsoTime;
	readonly updated: IsoTime;
};

export type EditPatch =
	| { readonly kind: "title"; readonly title: Title }
	| { readonly kind: "body"; readonly body: string }
	| { readonly kind: "both"; readonly title: Title; readonly body: string };

export type CreateInput = {
	readonly title: Title;
	readonly body: string;
};

export type IdInput = {
	readonly id: NoteId;
};

export type EditInput = {
	readonly id: NoteId;
	readonly patch: EditPatch;
};

export type SearchInput = {
	readonly query: string;
};

const NOTE_ID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const TITLE_LINE_BREAK = /[\n\r]/;

export function isNoteId(input: string): input is NoteId {
	return NOTE_ID.test(input);
}

export function parseNoteId(input: string): NoteId | undefined {
	const canonical = input.toUpperCase();
	if (!isNoteId(canonical)) {
		return undefined;
	}
	return canonical;
}

export function isTitle(input: string): input is Title {
	return !TITLE_LINE_BREAK.test(input);
}

export function parseTitle(input: string): Title | undefined {
	if (!isTitle(input)) {
		return undefined;
	}
	return input;
}

export function isIsoTime(input: string): input is IsoTime {
	if (!ISO_TIME.test(input)) {
		return false;
	}
	const parsed = new Date(input);
	if (Number.isNaN(parsed.getTime())) {
		return false;
	}
	return parsed.toISOString() === input;
}

export function parseIsoTime(input: string): IsoTime | undefined {
	if (!isIsoTime(input)) {
		return undefined;
	}
	return input;
}

export function assembleNote(fields: {
	readonly id: NoteId;
	readonly title: Title;
	readonly body: string;
	readonly created: IsoTime;
	readonly updated: IsoTime;
}): Note {
	return {
		id: fields.id,
		title: fields.title,
		body: fields.body,
		created: fields.created,
		updated: fields.updated,
	};
}
