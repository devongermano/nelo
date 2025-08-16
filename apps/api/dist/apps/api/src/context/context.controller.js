"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextController = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestia/core");
const context_service_1 = require("./context.service");
let ContextController = class ContextController {
    constructor(contextService) {
        this.contextService = contextService;
    }
    compose(body) {
        return this.contextService.compose(body);
    }
};
exports.ContextController = ContextController;
__decorate([
    core_1.TypedRoute.Post('compose-context', { type: "assert", assert: (() => { const $guard = core_1.TypedRoute.Post.guard; const $io0 = input => Array.isArray(input.segments) && Array.isArray(input.redactions); const $ao0 = (input, _path, _exceptionable = true) => (Array.isArray(input.segments) || $guard(_exceptionable, {
            path: _path + ".segments",
            expected: "Array<any>",
            value: input.segments
        }, _errorFactory)) && (Array.isArray(input.redactions) || $guard(_exceptionable, {
            path: _path + ".redactions",
            expected: "Array<any>",
            value: input.redactions
        }, _errorFactory)); const $so0 = input => `{"segments":${`[${input.segments.map(elem => undefined !== elem ? JSON.stringify(elem) : "null").join(",")}]`},"redactions":${`[${input.redactions.map(elem => undefined !== elem ? JSON.stringify(elem) : "null").join(",")}]`}}`; const __is = input => "object" === typeof input && null !== input && $io0(input); let _errorFactory; const __assert = (input, errorFactory) => {
            if (false === __is(input)) {
                _errorFactory = errorFactory;
                ((input, _path, _exceptionable = true) => ("object" === typeof input && null !== input || $guard(true, {
                    path: _path + "",
                    expected: "ComposeContextResult",
                    value: input
                }, _errorFactory)) && $ao0(input, _path + "", true) || $guard(true, {
                    path: _path + "",
                    expected: "ComposeContextResult",
                    value: input
                }, _errorFactory))(input, "$input", true);
            }
            return input;
        }; const __stringify = input => $so0(input); return (input, errorFactory) => {
            __assert(input, errorFactory);
            return __stringify(input);
        }; })() }),
    __param(0, (0, core_1.TypedBody)({ type: "assert", assert: (() => { const $guard = core_1.TypedBody.guard; const $io0 = input => "string" === typeof input.template; const $ao0 = (input, _path, _exceptionable = true) => "string" === typeof input.template || $guard(_exceptionable, {
            path: _path + ".template",
            expected: "string",
            value: input.template
        }, _errorFactory); const __is = input => "object" === typeof input && null !== input && $io0(input); let _errorFactory; return (input, errorFactory) => {
            if (false === __is(input)) {
                _errorFactory = errorFactory;
                ((input, _path, _exceptionable = true) => ("object" === typeof input && null !== input || $guard(true, {
                    path: _path + "",
                    expected: "ComposeContextOptions",
                    value: input
                }, _errorFactory)) && $ao0(input, _path + "", true) || $guard(true, {
                    path: _path + "",
                    expected: "ComposeContextOptions",
                    value: input
                }, _errorFactory))(input, "$input", true);
            }
            return input;
        }; })() })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ContextController.prototype, "compose", null);
exports.ContextController = ContextController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [context_service_1.ContextService])
], ContextController);
