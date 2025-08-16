"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComposeContextOptionsSchema = void 0;
exports.composeContext = composeContext;
const types_1 = require("./types");
function composeContext(options) {
    types_1.ComposeContextOptionsSchema.parse(options);
    return { segments: [], redactions: [] };
}
var types_2 = require("./types");
Object.defineProperty(exports, "ComposeContextOptionsSchema", { enumerable: true, get: function () { return types_2.ComposeContextOptionsSchema; } });
