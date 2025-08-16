"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const throttler_1 = require("@nestjs/throttler");
const config_1 = require("./config");
const context_module_1 = require("./context/context.module");
const projects_module_1 = require("./projects/projects.module");
const scenes_module_1 = require("./scenes/scenes.module");
const gateway_module_1 = require("./gateway/gateway.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            throttler_1.ThrottlerModule.forRoot([
                {
                    name: 'short',
                    ttl: 1000, // 1 second
                    limit: 10, // 10 requests per second
                },
                {
                    name: 'medium',
                    ttl: 10000, // 10 seconds
                    limit: 50, // 50 requests per 10 seconds
                },
                {
                    name: 'long',
                    ttl: 60000, // 1 minute
                    limit: 100, // 100 requests per minute
                },
            ]),
            projects_module_1.ProjectsModule,
            scenes_module_1.ScenesModule,
            context_module_1.ContextModule,
            gateway_module_1.GatewayModule,
        ],
        providers: [
            {
                provide: core_1.APP_GUARD,
                useClass: throttler_1.ThrottlerGuard,
            },
        ],
    })
], AppModule);
