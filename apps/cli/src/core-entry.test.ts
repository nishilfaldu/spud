import { expect, test } from "bun:test";
import * as core from "@spud/core";
import cliPackage from "../package.json" with { type: "json" };

test("core public barrel is empty", () => {
	expect(Object.keys(core)).toEqual([]);
});

test("cli depends on @spud/core via workspace:*", () => {
	expect(cliPackage.dependencies["@spud/core"]).toBe("workspace:*");
});
