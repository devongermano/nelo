"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.versionMiddleware = versionMiddleware;
function versionMiddleware(request, reply, done) {
    const ifMatch = request.headers['if-match'];
    const scene = request.scene;
    if (!ifMatch || typeof ifMatch !== 'string') {
        reply.status(400).send({ error: 'If-Match header required' });
        return;
    }
    if (!scene) {
        reply.status(404).send({ error: 'Scene not found' });
        return;
    }
    if (String(scene.version) !== ifMatch) {
        reply.status(412).send({ error: 'Version mismatch' });
        return;
    }
    done();
}
//# sourceMappingURL=version.middleware.js.map