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
exports.PresenceGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const ws_1 = require("ws");
const crypto_1 = require("crypto");
const events_1 = require("./events");
let PresenceGateway = class PresenceGateway {
    constructor() {
        this.sessions = new Map();
    }
    handleConnection(client) {
        const sessionId = (0, crypto_1.randomUUID)();
        this.sessions.set(client, sessionId);
        const hello = {
            event: events_1.GATEWAY_EVENTS.HELLO,
            data: { sessionId },
        };
        client.send(JSON.stringify(hello));
    }
    handleDisconnect(client) {
        this.sessions.delete(client);
    }
    handlePing(client) {
        const pong = { event: events_1.GATEWAY_EVENTS.PONG };
        client.send(JSON.stringify(pong));
    }
};
exports.PresenceGateway = PresenceGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", ws_1.Server)
], PresenceGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)(events_1.GATEWAY_EVENTS.PING),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PresenceGateway.prototype, "handlePing", null);
exports.PresenceGateway = PresenceGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ adapter: 'ws' })
], PresenceGateway);
//# sourceMappingURL=presence.gateway.nestjs.js.map