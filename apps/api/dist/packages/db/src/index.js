"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyHashedData = exports.hashData = exports.decryptApiKey = exports.encryptApiKey = exports.prisma = void 0;
exports.seed = seed;
exports.reset = reset;
const client_1 = require("./client");
Object.defineProperty(exports, "prisma", { enumerable: true, get: function () { return client_1.prisma; } });
async function seed() {
    await client_1.prisma.$connect();
}
async function reset() {
    // Safe reset helper for tests using Prisma methods
    // This approach is much safer than raw SQL and prevents injection attacks
    await client_1.prisma.$transaction([
        client_1.prisma.embedding.deleteMany(),
        client_1.prisma.sceneEntity.deleteMany(),
        client_1.prisma.sentence.deleteMany(),
        client_1.prisma.snapshot.deleteMany(),
        client_1.prisma.editSpan.deleteMany(),
        client_1.prisma.hunk.deleteMany(),
        client_1.prisma.patch.deleteMany(),
        client_1.prisma.refactor.deleteMany(),
        client_1.prisma.costEvent.deleteMany(),
        client_1.prisma.run.deleteMany(),
        client_1.prisma.contextRule.deleteMany(),
        client_1.prisma.canonFact.deleteMany(),
        client_1.prisma.entity.deleteMany(),
        client_1.prisma.scene.deleteMany(),
        client_1.prisma.chapter.deleteMany(),
        client_1.prisma.book.deleteMany(),
        client_1.prisma.providerKey.deleteMany(),
        client_1.prisma.budget.deleteMany(),
        client_1.prisma.styleGuide.deleteMany(),
        client_1.prisma.membership.deleteMany(),
        client_1.prisma.user.deleteMany(),
        client_1.prisma.project.deleteMany(),
    ]);
}
var crypto_1 = require("./crypto");
Object.defineProperty(exports, "encryptApiKey", { enumerable: true, get: function () { return crypto_1.encryptApiKey; } });
Object.defineProperty(exports, "decryptApiKey", { enumerable: true, get: function () { return crypto_1.decryptApiKey; } });
Object.defineProperty(exports, "hashData", { enumerable: true, get: function () { return crypto_1.hashData; } });
Object.defineProperty(exports, "verifyHashedData", { enumerable: true, get: function () { return crypto_1.verifyHashedData; } });
