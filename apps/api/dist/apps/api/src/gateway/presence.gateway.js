"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPresenceGateway = createPresenceGateway;
const ws_1 = require("ws");
const crypto_1 = require("crypto");
const events_1 = require("./events");
function createPresenceGateway(port) {
    const wss = new ws_1.WebSocketServer({ port });
    wss.on('connection', (ws) => {
        const sessionId = (0, crypto_1.randomUUID)();
        const hello = {
            event: events_1.GATEWAY_EVENTS.HELLO,
            data: { sessionId },
        };
        ws.send(JSON.stringify(hello));
        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.event === events_1.GATEWAY_EVENTS.PING) {
                    const pong = { event: events_1.GATEWAY_EVENTS.PONG };
                    ws.send(JSON.stringify(pong));
                }
            }
            catch {
                // ignore malformed messages
            }
        });
    });
    return wss;
}
