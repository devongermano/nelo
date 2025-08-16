"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SceneConcurrentUpdateException = void 0;
const common_1 = require("@nestjs/common");
class SceneConcurrentUpdateException extends common_1.ConflictException {
    constructor(sceneId) {
        const message = sceneId
            ? `Scene with ID ${sceneId} was modified by another user. Please refresh and try again.`
            : 'Scene was modified by another user. Please refresh and try again.';
        super(message);
    }
}
exports.SceneConcurrentUpdateException = SceneConcurrentUpdateException;
