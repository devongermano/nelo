"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const ws_1 = __importDefault(require("ws"));
const presence_gateway_1 = require("./presence.gateway");
const events_1 = require("./events");
(0, vitest_1.describe)('presence gateway', () => {
    (0, vitest_1.it)('sends HELLO on connect and PONG for PING', async () => {
        const wss = (0, presence_gateway_1.createPresenceGateway)(0);
        const port = wss.address().port;
        const ws = new ws_1.default(`ws://localhost:${port}`);
        const helloPromise = new Promise((resolve) => ws.once('message', (data) => resolve(JSON.parse(data.toString()))));
        await new Promise((resolve) => ws.once('open', resolve));
        const hello = await helloPromise;
        (0, vitest_1.expect)(hello.event).toBe(events_1.GATEWAY_EVENTS.HELLO);
        (0, vitest_1.expect)(hello.data.sessionId).toBeTypeOf('string');
        const pongPromise = new Promise((resolve) => ws.once('message', (data) => resolve(JSON.parse(data.toString()))));
        ws.send(JSON.stringify({ event: events_1.GATEWAY_EVENTS.PING }));
        const pong = await pongPromise;
        (0, vitest_1.expect)(pong.event).toBe(events_1.GATEWAY_EVENTS.PONG);
        ws.close();
        wss.close();
    });
});
