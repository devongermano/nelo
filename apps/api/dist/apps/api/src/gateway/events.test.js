"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const events_1 = require("./events");
(0, vitest_1.describe)('gateway events constants', () => {
    (0, vitest_1.it)('should expose expected event names', () => {
        (0, vitest_1.expect)(events_1.GATEWAY_EVENTS.HELLO).toBe('HELLO');
        (0, vitest_1.expect)(events_1.GATEWAY_EVENTS.PING).toBe('PING');
        (0, vitest_1.expect)(events_1.GATEWAY_EVENTS.PONG).toBe('PONG');
    });
});
