"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnvironment = void 0;
exports.validate = validate;
const typia_1 = __importDefault(require("typia"));
exports.validateEnvironment = (() => { const $guard = typia_1.default.createAssert.guard; const $io0 = input => (undefined === input.NODE_ENV || "development" === input.NODE_ENV || "production" === input.NODE_ENV || "test" === input.NODE_ENV) && (undefined === input.PORT || "number" === typeof input.PORT && (Math.floor(input.PORT) === input.PORT && 0 <= input.PORT && input.PORT <= 4294967295 && 1 <= input.PORT && input.PORT <= 65535)) && (undefined === input.DATABASE_URL || "string" === typeof input.DATABASE_URL) && (undefined === input.REDIS_URL || "string" === typeof input.REDIS_URL) && (undefined === input.CORS_ORIGINS || "string" === typeof input.CORS_ORIGINS); const $ao0 = (input, _path, _exceptionable = true) => (undefined === input.NODE_ENV || "development" === input.NODE_ENV || "production" === input.NODE_ENV || "test" === input.NODE_ENV || $guard(_exceptionable, {
    path: _path + ".NODE_ENV",
    expected: "((\"development\" & (Default<\"development\">)) | (\"production\" & (Default<\"development\">)) | (\"test\" & (Default<\"development\">)) | undefined)",
    value: input.NODE_ENV
}, _errorFactory)) && (undefined === input.PORT || "number" === typeof input.PORT && (Math.floor(input.PORT) === input.PORT && 0 <= input.PORT && input.PORT <= 4294967295 || $guard(_exceptionable, {
    path: _path + ".PORT",
    expected: "number & Type<\"uint32\">",
    value: input.PORT
}, _errorFactory)) && (1 <= input.PORT || $guard(_exceptionable, {
    path: _path + ".PORT",
    expected: "number & Minimum<1>",
    value: input.PORT
}, _errorFactory)) && (input.PORT <= 65535 || $guard(_exceptionable, {
    path: _path + ".PORT",
    expected: "number & Maximum<65535>",
    value: input.PORT
}, _errorFactory)) || $guard(_exceptionable, {
    path: _path + ".PORT",
    expected: "((number & Type<\"uint32\"> & Minimum<1> & Maximum<65535> & Default<3001>) | undefined)",
    value: input.PORT
}, _errorFactory)) && (undefined === input.DATABASE_URL || "string" === typeof input.DATABASE_URL || $guard(_exceptionable, {
    path: _path + ".DATABASE_URL",
    expected: "((string & Default<\"postgresql://localhost:5432/nelo\">) | undefined)",
    value: input.DATABASE_URL
}, _errorFactory)) && (undefined === input.REDIS_URL || "string" === typeof input.REDIS_URL || $guard(_exceptionable, {
    path: _path + ".REDIS_URL",
    expected: "((string & Default<\"redis://localhost:6379\">) | undefined)",
    value: input.REDIS_URL
}, _errorFactory)) && (undefined === input.CORS_ORIGINS || "string" === typeof input.CORS_ORIGINS || $guard(_exceptionable, {
    path: _path + ".CORS_ORIGINS",
    expected: "((string & Default<\"http://localhost:3000\">) | undefined)",
    value: input.CORS_ORIGINS
}, _errorFactory)); const __is = input => "object" === typeof input && null !== input && false === Array.isArray(input) && $io0(input); let _errorFactory; return (input, errorFactory) => {
    if (false === __is(input)) {
        _errorFactory = errorFactory;
        ((input, _path, _exceptionable = true) => ("object" === typeof input && null !== input && false === Array.isArray(input) || $guard(true, {
            path: _path + "",
            expected: "EnvironmentVariables",
            value: input
        }, _errorFactory)) && $ao0(input, _path + "", true) || $guard(true, {
            path: _path + "",
            expected: "EnvironmentVariables",
            value: input
        }, _errorFactory))(input, "$input", true);
    }
    return input;
}; })();
function validate(config) {
    // Apply defaults and validate
    const validated = (0, exports.validateEnvironment)(config);
    return validated;
}
//# sourceMappingURL=environment.validation.js.map