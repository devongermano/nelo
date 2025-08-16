"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateComposeContextOptions = void 0;
exports.composeContext = composeContext;
const types_1 = require("./types");
function composeContext(options) {
    const validation = (0, types_1.validateComposeContextOptions)(options);
    if (!validation.success) {
        throw new Error('Invalid options: ' + JSON.stringify(validation.errors));
    }
    return { segments: [], redactions: [] };
}
var types_2 = require("./types");
Object.defineProperty(exports, "validateComposeContextOptions", { enumerable: true, get: function () { return types_2.validateComposeContextOptions; } });
//# sourceMappingURL=index.js.map