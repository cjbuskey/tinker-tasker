"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.anthropic = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey && process.env.FUNCTIONS_EMULATOR !== 'true') {
    console.warn('ANTHROPIC_API_KEY is not set. Cloud Function will fail at runtime.');
}
exports.anthropic = new sdk_1.default({
    apiKey: apiKey || '',
});
