import { assert } from 'chai';
import { PLACEHOLDER } from "./index.ts";

describe("PLACEHOLDER", function() {
    it("should be equal to 42", function() {
        assert.strictEqual(PLACEHOLDER, 42);
    });
});