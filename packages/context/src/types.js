"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateComposeContextOptions = void 0;
const typia_1 = __importDefault(require("typia"));
exports.validateComposeContextOptions = (() => { const $io0 = input => "string" === typeof input.template; const $vo0 = (input, _path, _exceptionable = true) => ["string" === typeof input.template || $report(_exceptionable, {
        path: _path + ".template",
        expected: "string",
        value: input.template
    })].every(flag => flag); const __is = input => "object" === typeof input && null !== input && $io0(input); let errors; let $report; return input => {
    if (false === __is(input)) {
        errors = [];
        $report = typia_1.default.createValidate.report(errors);
        ((input, _path, _exceptionable = true) => ("object" === typeof input && null !== input || $report(true, {
            path: _path + "",
            expected: "ComposeContextOptions",
            value: input
        })) && $vo0(input, _path + "", true) || $report(true, {
            path: _path + "",
            expected: "ComposeContextOptions",
            value: input
        }))(input, "$input", true);
        const success = 0 === errors.length;
        return {
            success,
            errors,
            data: success ? input : undefined
        };
    }
    return {
        success: true,
        errors: [],
        data: input
    };
}; })();
//# sourceMappingURL=types.js.map