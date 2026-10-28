import { expect, test } from "bun:test";
import * as core from "@spud/core";

type CorePublic = typeof import("@spud/core");
type AssertEmpty<T> = keyof T extends never ? true : never;

test("public barrel exports nothing", () => {
	const empty: AssertEmpty<CorePublic> = true;
	expect(empty).toBe(true);
	expect(Object.keys(core)).toEqual([]);
});
