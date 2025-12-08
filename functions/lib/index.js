"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.coachAgent = void 0;
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const admin = __importStar(require("firebase-admin"));
const coachAgent_1 = require("./coachAgent");
if (!admin.apps.length) {
    admin.initializeApp();
}
(0, v2_1.setGlobalOptions)({ secrets: ['ANTHROPIC_API_KEY'] });
exports.coachAgent = (0, https_1.onCall)(async (request) => {
    const userId = request.auth?.uid ?? 'default';
    const userMessage = (request.data && typeof request.data.message === 'string' && request.data.message) || '';
    if (!userMessage) {
        throw new https_1.HttpsError('invalid-argument', 'message is required');
    }
    try {
        const result = await (0, coachAgent_1.runCoachAgent)(userId, userMessage);
        return result;
    }
    catch (err) {
        console.error('coachAgent error', err);
        throw new https_1.HttpsError('internal', err?.message || 'Unknown error');
    }
});
