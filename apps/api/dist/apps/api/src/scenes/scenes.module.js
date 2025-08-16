"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScenesModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const scenes_controller_1 = require("./scenes.controller");
const scenes_service_1 = require("./scenes.service");
const idempotency_interceptor_1 = require("../interceptors/idempotency.interceptor");
const redis_1 = require("../redis");
let ScenesModule = class ScenesModule {
};
exports.ScenesModule = ScenesModule;
exports.ScenesModule = ScenesModule = __decorate([
    (0, common_1.Module)({
        controllers: [scenes_controller_1.ScenesController],
        providers: [
            scenes_service_1.ScenesService,
            idempotency_interceptor_1.IdempotencyInterceptor,
            {
                provide: idempotency_interceptor_1.IDEMPOTENCY_REDIS,
                useFactory: (configService) => {
                    const logger = new common_1.Logger('ScenesModule:Redis');
                    return (0, redis_1.createRedisConnection)({
                        url: configService.get('REDIS_URL'),
                    }, logger);
                },
                inject: [config_1.ConfigService],
            },
        ],
    })
], ScenesModule);
