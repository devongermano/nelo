"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IfMatchHeader = void 0;
const common_1 = require("@nestjs/common");
exports.IfMatchHeader = (0, common_1.createParamDecorator)((_data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    const value = request.headers['if-match'];
    if (typeof value !== 'string' || value.length === 0) {
        throw new common_1.BadRequestException('If-Match header required');
    }
    return value;
});
//# sourceMappingURL=if-match-header.decorator.js.map