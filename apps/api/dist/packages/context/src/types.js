"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComposeContextOptionsSchema = void 0;
const zod_1 = require("zod");
exports.ComposeContextOptionsSchema = zod_1.z.object({
    template: zod_1.z.string()
});
