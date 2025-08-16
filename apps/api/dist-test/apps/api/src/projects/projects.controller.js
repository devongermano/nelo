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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectsController = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestia/core");
const projects_service_1 = require("./projects.service");
let ProjectsController = class ProjectsController {
    constructor(projectsService) {
        this.projectsService = projectsService;
    }
    getAll() {
        return this.projectsService.getAllProjects();
    }
};
exports.ProjectsController = ProjectsController;
__decorate([
    core_1.TypedRoute.Get({ type: "assert", assert: (() => { const $guard = core_1.TypedRoute.Get.guard; const $string = core_1.TypedRoute.Get.string; const $throws = core_1.TypedRoute.Get.throws; const $io0 = input => "PrismaPromise" === input["__@toStringTag@1405"]; const $ao0 = (input, _path, _exceptionable = true) => "PrismaPromise" === input["__@toStringTag@1405"] || $guard(_exceptionable, {
            path: _path + "[\"__@toStringTag@1405\"]",
            expected: "\"PrismaPromise\"",
            value: input["__@toStringTag@1405"]
        }, _errorFactory); const $so0 = input => `{"__@toStringTag@1405":${(() => {
            if ("string" === typeof input["__@toStringTag@1405"])
                return $string(input["__@toStringTag@1405"]);
            if ("string" === typeof input["__@toStringTag@1405"])
                return "\"" + input["__@toStringTag@1405"] + "\"";
            $throws({
                expected: "\"PrismaPromise\"",
                value: input["__@toStringTag@1405"]
            });
        })()}}`; const __is = input => "object" === typeof input && null !== input && $io0(input); let _errorFactory; const __assert = (input, errorFactory) => {
            if (false === __is(input)) {
                _errorFactory = errorFactory;
                ((input, _path, _exceptionable = true) => ("object" === typeof input && null !== input || $guard(true, {
                    path: _path + "",
                    expected: "Prisma.PrismaPromise<Array<__type>>",
                    value: input
                }, _errorFactory)) && $ao0(input, _path + "", true) || $guard(true, {
                    path: _path + "",
                    expected: "Prisma.PrismaPromise<Array<__type>>",
                    value: input
                }, _errorFactory))(input, "$input", true);
            }
            return input;
        }; const __stringify = input => $so0(input); return (input, errorFactory) => {
            __assert(input, errorFactory);
            return __stringify(input);
        }; })() }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProjectsController.prototype, "getAll", null);
exports.ProjectsController = ProjectsController = __decorate([
    (0, common_1.Controller)('projects'),
    __metadata("design:paramtypes", [projects_service_1.ProjectsService])
], ProjectsController);
//# sourceMappingURL=projects.controller.js.map