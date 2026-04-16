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
const config_plugins_1 = require("@expo/config-plugins");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const WATCH_TARGET_NAME = "CarelogWatch";
const APP_GROUP_SUFFIX = ".watch";
/**
 * Config plugin that:
 * 1. Adds App Group entitlement to the main iOS target (required for WCSession)
 * 2. Adds a watchOS single-target SwiftUI app to the generated Xcode project
 *
 * Source files are copied from apps/mobile/watchos/CarelogWatch/ into
 * ios/CarelogWatch/ during expo prebuild.
 *
 * Android: this plugin is a no-op on Android (watchOS is iOS-only).
 */
const withCarelogWatch = (config) => {
    // Guard: watchOS is iOS-only — skip all mods when building for Android
    if (!config.ios) {
        return config;
    }
    // Step 1: Add App Group entitlement to main iOS target
    config = (0, config_plugins_1.withEntitlementsPlist)(config, (mod) => {
        var _a, _b, _c;
        const existing = (_a = mod.modResults["com.apple.security.application-groups"]) !== null && _a !== void 0 ? _a : [];
        const bundleId = (_c = (_b = config.ios) === null || _b === void 0 ? void 0 : _b.bundleIdentifier) !== null && _c !== void 0 ? _c : "com.carelog.app";
        const appGroup = "group." + bundleId;
        if (!existing.includes(appGroup)) {
            mod.modResults["com.apple.security.application-groups"] = [
                ...existing,
                appGroup,
            ];
        }
        return mod;
    });
    // Step 2: Add Watch target to generated Xcode project
    config = (0, config_plugins_1.withXcodeProject)(config, (mod) => {
        var _a, _b;
        const xcodeProject = mod.modResults;
        const platformRoot = mod.modRequest.platformProjectRoot; // path to ios/
        // Guard: don't add the target twice on repeated prebuild runs
        if (xcodeProject.pbxTargetByName(WATCH_TARGET_NAME)) {
            return mod;
        }
        const bundleId = (_b = (_a = config.ios) === null || _a === void 0 ? void 0 : _a.bundleIdentifier) !== null && _b !== void 0 ? _b : "com.carelog.app";
        const watchBundleId = bundleId + APP_GROUP_SUFFIX;
        // Copy Swift source files from watchos/CarelogWatch/ → ios/CarelogWatch/
        const srcDir = path.join(platformRoot, "..", "watchos", WATCH_TARGET_NAME);
        const dstDir = path.join(platformRoot, WATCH_TARGET_NAME);
        if (!fs.existsSync(dstDir)) {
            fs.mkdirSync(dstDir, { recursive: true });
        }
        const swiftFiles = fs
            .readdirSync(srcDir)
            .filter((f) => f.endsWith(".swift"));
        for (const file of swiftFiles) {
            fs.copyFileSync(path.join(srcDir, file), path.join(dstDir, file));
        }
        // Add the watchOS App native target
        const target = xcodeProject.addTarget(WATCH_TARGET_NAME, "watch2_app", WATCH_TARGET_NAME, watchBundleId);
        // Add Sources build phase to the watch target
        xcodeProject.addBuildPhase([], "PBXSourcesBuildPhase", "Sources", target.uuid);
        // Create a PBX group for the Watch source files so addSourceFile works
        const watchGroup = xcodeProject.addPbxGroup([], WATCH_TARGET_NAME, WATCH_TARGET_NAME);
        const watchGroupKey = watchGroup.uuid;
        // Register each Swift file in the Sources build phase
        for (const file of swiftFiles) {
            xcodeProject.addSourceFile(path.join(WATCH_TARGET_NAME, file), { target: target.uuid }, watchGroupKey);
        }
        // Set watchOS-specific build settings
        const buildConfigs = xcodeProject.pbxXCBuildConfigurationSection();
        for (const key of Object.keys(buildConfigs)) {
            const cfg = buildConfigs[key];
            if (cfg &&
                typeof cfg === "object" &&
                cfg.buildSettings &&
                cfg.buildSettings.PRODUCT_NAME === '"' + WATCH_TARGET_NAME + '"') {
                cfg.buildSettings.TARGETED_DEVICE_FAMILY = "4";
                cfg.buildSettings.WATCHOS_DEPLOYMENT_TARGET = "'7.0'";
                cfg.buildSettings.SWIFT_VERSION = "'5.0'";
                cfg.buildSettings.ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = "YES";
            }
        }
        return mod;
    });
    return config;
};
// ts-prune-ignore-next // Expo config plugin, consumed by app.json
exports.default = withCarelogWatch;
