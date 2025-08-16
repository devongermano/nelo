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
exports.ScenesController = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestia/core");
const idempotency_interceptor_1 = require("../interceptors/idempotency.interceptor");
const scenes_service_1 = require("./scenes.service");
const if_match_header_decorator_1 = require("../common/if-match-header.decorator");
let ScenesController = class ScenesController {
    constructor(scenesService) {
        this.scenesService = scenesService;
    }
    async create(dto) {
        const { content, chapterId, projectId } = dto;
        return this.scenesService.create(content, chapterId, projectId);
    }
    async update(id, ifMatch, dto) {
        // First verify the version matches what the client expects
        const currentScene = await this.scenesService.find(id);
        if (String(currentScene.version) !== ifMatch) {
            throw new common_1.PreconditionFailedException('Version mismatch - scene has been modified by another user');
        }
        // Perform atomic update with optimistic locking
        // The service handles all error scenarios including concurrent updates
        return await this.scenesService.update(id, dto.content, dto.order);
    }
    async get(id) {
        return this.scenesService.getSceneById(id);
    }
};
exports.ScenesController = ScenesController;
__decorate([
    (0, common_1.UseInterceptors)(idempotency_interceptor_1.IdempotencyInterceptor),
    core_1.TypedRoute.Post({ type: "assert", assert: (() => { const $guard = core_1.TypedRoute.Post.guard; const $string = core_1.TypedRoute.Post.string; const $io0 = input => "string" === typeof input.id && (null === input.content || "string" === typeof input.content) && "string" === typeof input.chapterId && "string" === typeof input.projectId && (null === input.order || "number" === typeof input.order && !Number.isNaN(input.order)) && ("number" === typeof input.version && !Number.isNaN(input.version)) && input.createdAt instanceof Date && input.updatedAt instanceof Date; const $ao0 = (input, _path, _exceptionable = true) => ("string" === typeof input.id || $guard(_exceptionable, {
            path: _path + ".id",
            expected: "string",
            value: input.id
        }, _errorFactory)) && (null === input.content || "string" === typeof input.content || $guard(_exceptionable, {
            path: _path + ".content",
            expected: "(null | string)",
            value: input.content
        }, _errorFactory)) && ("string" === typeof input.chapterId || $guard(_exceptionable, {
            path: _path + ".chapterId",
            expected: "string",
            value: input.chapterId
        }, _errorFactory)) && ("string" === typeof input.projectId || $guard(_exceptionable, {
            path: _path + ".projectId",
            expected: "string",
            value: input.projectId
        }, _errorFactory)) && (null === input.order || "number" === typeof input.order && !Number.isNaN(input.order) || $guard(_exceptionable, {
            path: _path + ".order",
            expected: "(null | number)",
            value: input.order
        }, _errorFactory)) && ("number" === typeof input.version && !Number.isNaN(input.version) || $guard(_exceptionable, {
            path: _path + ".version",
            expected: "number",
            value: input.version
        }, _errorFactory)) && (input.createdAt instanceof Date || $guard(_exceptionable, {
            path: _path + ".createdAt",
            expected: "Date",
            value: input.createdAt
        }, _errorFactory)) && (input.updatedAt instanceof Date || $guard(_exceptionable, {
            path: _path + ".updatedAt",
            expected: "Date",
            value: input.updatedAt
        }, _errorFactory)); const $so0 = input => `{"id":${$string(input.id)},"content":${null !== input.content ? $string(input.content) : "null"},"chapterId":${$string(input.chapterId)},"projectId":${$string(input.projectId)},"order":${null !== input.order ? input.order : "null"},"version":${input.version},"createdAt":${$string(input.createdAt.toJSON())},"updatedAt":${$string(input.updatedAt.toJSON())}}`; const __is = input => "object" === typeof input && null !== input && $io0(input); let _errorFactory; const __assert = (input, errorFactory) => {
            if (false === __is(input)) {
                _errorFactory = errorFactory;
                ((input, _path, _exceptionable = true) => ("object" === typeof input && null !== input || $guard(true, {
                    path: _path + "",
                    expected: "Scene",
                    value: input
                }, _errorFactory)) && $ao0(input, _path + "", true) || $guard(true, {
                    path: _path + "",
                    expected: "Scene",
                    value: input
                }, _errorFactory))(input, "$input", true);
            }
            return input;
        }; const __stringify = input => $so0(input); return (input, errorFactory) => {
            __assert(input, errorFactory);
            return __stringify(input);
        }; })() }),
    __param(0, (0, core_1.TypedBody)({ type: "assert", assert: (() => { const $guard = core_1.TypedBody.guard; const $io0 = input => "string" === typeof input.content && ("string" === typeof input.chapterId && /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(input.chapterId)) && ("string" === typeof input.projectId && /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(input.projectId)); const $ao0 = (input, _path, _exceptionable = true) => ("string" === typeof input.content || $guard(_exceptionable, {
            path: _path + ".content",
            expected: "string",
            value: input.content
        }, _errorFactory)) && ("string" === typeof input.chapterId && (/^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(input.chapterId) || $guard(_exceptionable, {
            path: _path + ".chapterId",
            expected: "string & Format<\"uuid\">",
            value: input.chapterId
        }, _errorFactory)) || $guard(_exceptionable, {
            path: _path + ".chapterId",
            expected: "(string & Format<\"uuid\">)",
            value: input.chapterId
        }, _errorFactory)) && ("string" === typeof input.projectId && (/^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(input.projectId) || $guard(_exceptionable, {
            path: _path + ".projectId",
            expected: "string & Format<\"uuid\">",
            value: input.projectId
        }, _errorFactory)) || $guard(_exceptionable, {
            path: _path + ".projectId",
            expected: "(string & Format<\"uuid\">)",
            value: input.projectId
        }, _errorFactory)); const __is = input => "object" === typeof input && null !== input && $io0(input); let _errorFactory; return (input, errorFactory) => {
            if (false === __is(input)) {
                _errorFactory = errorFactory;
                ((input, _path, _exceptionable = true) => ("object" === typeof input && null !== input || $guard(true, {
                    path: _path + "",
                    expected: "CreateSceneDto",
                    value: input
                }, _errorFactory)) && $ao0(input, _path + "", true) || $guard(true, {
                    path: _path + "",
                    expected: "CreateSceneDto",
                    value: input
                }, _errorFactory))(input, "$input", true);
            }
            return input;
        }; })() })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ScenesController.prototype, "create", null);
__decorate([
    core_1.TypedRoute.Patch(':id', { type: "assert", assert: (() => { const $guard = core_1.TypedRoute.Patch.guard; const $string = core_1.TypedRoute.Patch.string; const $io0 = input => "string" === typeof input.id && (null === input.content || "string" === typeof input.content) && "string" === typeof input.chapterId && "string" === typeof input.projectId && (null === input.order || "number" === typeof input.order && !Number.isNaN(input.order)) && ("number" === typeof input.version && !Number.isNaN(input.version)) && input.createdAt instanceof Date && input.updatedAt instanceof Date; const $ao0 = (input, _path, _exceptionable = true) => ("string" === typeof input.id || $guard(_exceptionable, {
            path: _path + ".id",
            expected: "string",
            value: input.id
        }, _errorFactory)) && (null === input.content || "string" === typeof input.content || $guard(_exceptionable, {
            path: _path + ".content",
            expected: "(null | string)",
            value: input.content
        }, _errorFactory)) && ("string" === typeof input.chapterId || $guard(_exceptionable, {
            path: _path + ".chapterId",
            expected: "string",
            value: input.chapterId
        }, _errorFactory)) && ("string" === typeof input.projectId || $guard(_exceptionable, {
            path: _path + ".projectId",
            expected: "string",
            value: input.projectId
        }, _errorFactory)) && (null === input.order || "number" === typeof input.order && !Number.isNaN(input.order) || $guard(_exceptionable, {
            path: _path + ".order",
            expected: "(null | number)",
            value: input.order
        }, _errorFactory)) && ("number" === typeof input.version && !Number.isNaN(input.version) || $guard(_exceptionable, {
            path: _path + ".version",
            expected: "number",
            value: input.version
        }, _errorFactory)) && (input.createdAt instanceof Date || $guard(_exceptionable, {
            path: _path + ".createdAt",
            expected: "Date",
            value: input.createdAt
        }, _errorFactory)) && (input.updatedAt instanceof Date || $guard(_exceptionable, {
            path: _path + ".updatedAt",
            expected: "Date",
            value: input.updatedAt
        }, _errorFactory)); const $so0 = input => `{"id":${$string(input.id)},"content":${null !== input.content ? $string(input.content) : "null"},"chapterId":${$string(input.chapterId)},"projectId":${$string(input.projectId)},"order":${null !== input.order ? input.order : "null"},"version":${input.version},"createdAt":${$string(input.createdAt.toJSON())},"updatedAt":${$string(input.updatedAt.toJSON())}}`; const __is = input => "object" === typeof input && null !== input && $io0(input); let _errorFactory; const __assert = (input, errorFactory) => {
            if (false === __is(input)) {
                _errorFactory = errorFactory;
                ((input, _path, _exceptionable = true) => ("object" === typeof input && null !== input || $guard(true, {
                    path: _path + "",
                    expected: "Scene",
                    value: input
                }, _errorFactory)) && $ao0(input, _path + "", true) || $guard(true, {
                    path: _path + "",
                    expected: "Scene",
                    value: input
                }, _errorFactory))(input, "$input", true);
            }
            return input;
        }; const __stringify = input => $so0(input); return (input, errorFactory) => {
            __assert(input, errorFactory);
            return __stringify(input);
        }; })() }),
    __param(0, (0, core_1.TypedParam)('id', input => {
        const $string = core_1.TypedParam.string;
        const assert = (() => { const $guard = core_1.TypedParam.guard; const __is = input => "string" === typeof input; let _errorFactory; return (input, errorFactory) => {
            if (false === __is(input)) {
                _errorFactory = errorFactory;
                ((input, _path, _exceptionable = true) => "string" === typeof input || $guard(true, {
                    path: _path + "",
                    expected: "string",
                    value: input
                }, _errorFactory))(input, "$input", true);
            }
            return input;
        }; })();
        const value = $string(input);
        return assert(value);
    })),
    __param(1, (0, if_match_header_decorator_1.IfMatchHeader)()),
    __param(2, (0, core_1.TypedBody)({ type: "assert", assert: (() => { const $guard = core_1.TypedBody.guard; const $io0 = input => (undefined === input.content || "string" === typeof input.content) && (undefined === input.order || "number" === typeof input.order && (Math.floor(input.order) === input.order && 0 <= input.order && input.order <= 4294967295 && 0 <= input.order)); const $ao0 = (input, _path, _exceptionable = true) => (undefined === input.content || "string" === typeof input.content || $guard(_exceptionable, {
            path: _path + ".content",
            expected: "(string | undefined)",
            value: input.content
        }, _errorFactory)) && (undefined === input.order || "number" === typeof input.order && (Math.floor(input.order) === input.order && 0 <= input.order && input.order <= 4294967295 || $guard(_exceptionable, {
            path: _path + ".order",
            expected: "number & Type<\"uint32\">",
            value: input.order
        }, _errorFactory)) && (0 <= input.order || $guard(_exceptionable, {
            path: _path + ".order",
            expected: "number & Minimum<0>",
            value: input.order
        }, _errorFactory)) || $guard(_exceptionable, {
            path: _path + ".order",
            expected: "((number & Type<\"uint32\"> & Minimum<0>) | undefined)",
            value: input.order
        }, _errorFactory)); const __is = input => "object" === typeof input && null !== input && false === Array.isArray(input) && $io0(input); let _errorFactory; return (input, errorFactory) => {
            if (false === __is(input)) {
                _errorFactory = errorFactory;
                ((input, _path, _exceptionable = true) => ("object" === typeof input && null !== input && false === Array.isArray(input) || $guard(true, {
                    path: _path + "",
                    expected: "UpdateSceneDto",
                    value: input
                }, _errorFactory)) && $ao0(input, _path + "", true) || $guard(true, {
                    path: _path + "",
                    expected: "UpdateSceneDto",
                    value: input
                }, _errorFactory))(input, "$input", true);
            }
            return input;
        }; })() })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], ScenesController.prototype, "update", null);
__decorate([
    core_1.TypedRoute.Get(':id', { type: "assert", assert: (() => { const $guard = core_1.TypedRoute.Get.guard; const $string = core_1.TypedRoute.Get.string; const $io0 = input => "string" === typeof input.id && (null === input.content || "string" === typeof input.content) && "string" === typeof input.chapterId && "string" === typeof input.projectId && (null === input.order || "number" === typeof input.order && !Number.isNaN(input.order)) && ("number" === typeof input.version && !Number.isNaN(input.version)) && input.createdAt instanceof Date && input.updatedAt instanceof Date; const $ao0 = (input, _path, _exceptionable = true) => ("string" === typeof input.id || $guard(_exceptionable, {
            path: _path + ".id",
            expected: "string",
            value: input.id
        }, _errorFactory)) && (null === input.content || "string" === typeof input.content || $guard(_exceptionable, {
            path: _path + ".content",
            expected: "(null | string)",
            value: input.content
        }, _errorFactory)) && ("string" === typeof input.chapterId || $guard(_exceptionable, {
            path: _path + ".chapterId",
            expected: "string",
            value: input.chapterId
        }, _errorFactory)) && ("string" === typeof input.projectId || $guard(_exceptionable, {
            path: _path + ".projectId",
            expected: "string",
            value: input.projectId
        }, _errorFactory)) && (null === input.order || "number" === typeof input.order && !Number.isNaN(input.order) || $guard(_exceptionable, {
            path: _path + ".order",
            expected: "(null | number)",
            value: input.order
        }, _errorFactory)) && ("number" === typeof input.version && !Number.isNaN(input.version) || $guard(_exceptionable, {
            path: _path + ".version",
            expected: "number",
            value: input.version
        }, _errorFactory)) && (input.createdAt instanceof Date || $guard(_exceptionable, {
            path: _path + ".createdAt",
            expected: "Date",
            value: input.createdAt
        }, _errorFactory)) && (input.updatedAt instanceof Date || $guard(_exceptionable, {
            path: _path + ".updatedAt",
            expected: "Date",
            value: input.updatedAt
        }, _errorFactory)); const $so0 = input => `{"id":${$string(input.id)},"content":${null !== input.content ? $string(input.content) : "null"},"chapterId":${$string(input.chapterId)},"projectId":${$string(input.projectId)},"order":${null !== input.order ? input.order : "null"},"version":${input.version},"createdAt":${$string(input.createdAt.toJSON())},"updatedAt":${$string(input.updatedAt.toJSON())}}`; const __is = input => "object" === typeof input && null !== input && $io0(input); let _errorFactory; const __assert = (input, errorFactory) => {
            if (false === __is(input)) {
                _errorFactory = errorFactory;
                ((input, _path, _exceptionable = true) => ("object" === typeof input && null !== input || $guard(true, {
                    path: _path + "",
                    expected: "Scene",
                    value: input
                }, _errorFactory)) && $ao0(input, _path + "", true) || $guard(true, {
                    path: _path + "",
                    expected: "Scene",
                    value: input
                }, _errorFactory))(input, "$input", true);
            }
            return input;
        }; const __stringify = input => $so0(input); return (input, errorFactory) => {
            __assert(input, errorFactory);
            return __stringify(input);
        }; })() }),
    __param(0, (0, core_1.TypedParam)('id', input => {
        const $string = core_1.TypedParam.string;
        const assert = (() => { const $guard = core_1.TypedParam.guard; const __is = input => "string" === typeof input; let _errorFactory; return (input, errorFactory) => {
            if (false === __is(input)) {
                _errorFactory = errorFactory;
                ((input, _path, _exceptionable = true) => "string" === typeof input || $guard(true, {
                    path: _path + "",
                    expected: "string",
                    value: input
                }, _errorFactory))(input, "$input", true);
            }
            return input;
        }; })();
        const value = $string(input);
        return assert(value);
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ScenesController.prototype, "get", null);
exports.ScenesController = ScenesController = __decorate([
    (0, common_1.Controller)('scenes'),
    __metadata("design:paramtypes", [scenes_service_1.ScenesService])
], ScenesController);
//# sourceMappingURL=scenes.controller.js.map