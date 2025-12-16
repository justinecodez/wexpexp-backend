"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables first
dotenv_1.default.config();
const app_1 = __importDefault(require("./dist/app"));
const logger_1 = __importDefault(require("./dist/config/logger"));
async function startServer() {
    try {
        const app = new app_1.default();
        await app.start();
    }
    catch (error) {
        logger_1.default.error('Failed to start application:', error);
    }
}
// Start the server
startServer();
//# sourceMappingURL=server.js.map