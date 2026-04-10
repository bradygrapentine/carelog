import {
  ConfigPlugin,
  withXcodeProject,
  withEntitlementsPlist,
} from '@expo/config-plugins'
import * as path from 'path'
import * as fs from 'fs'

const WATCH_TARGET_NAME = 'CarelogWatch'
const APP_GROUP_SUFFIX  = '.watch'

/**
 * Config plugin that:
 * 1. Adds App Group entitlement to the main iOS target (required for WCSession)
 * 2. Adds a watchOS single-target SwiftUI app to the generated Xcode project
 *
 * Source files are copied from apps/mobile/watchos/CarelogWatch/ into
 * ios/CarelogWatch/ during expo prebuild.
 */
const withCarelogWatch: ConfigPlugin = (config) => {
  // Step 1: Add App Group entitlement to main iOS target
  config = withEntitlementsPlist(config, (mod) => {
    const existing =
      (mod.modResults['com.apple.security.application-groups'] as string[]) ?? []
    const bundleId = config.ios?.bundleIdentifier ?? 'com.carelog.app'
    const appGroup = 'group.' + bundleId
    if (!existing.includes(appGroup)) {
      mod.modResults['com.apple.security.application-groups'] = [...existing, appGroup]
    }
    return mod
  })

  // Step 2: Add Watch target to generated Xcode project
  config = withXcodeProject(config, (mod) => {
    // XcodeProject is an internal expo type — use any to avoid type errors
    const xcodeProject = mod.modResults as any
    const platformRoot = mod.modRequest.platformProjectRoot // path to ios/

    // Guard: don't add the target twice on repeated prebuild runs
    if (xcodeProject.pbxTargetByName(WATCH_TARGET_NAME)) {
      return mod
    }

    const bundleId = config.ios?.bundleIdentifier ?? 'com.carelog.app'
    const watchBundleId = bundleId + APP_GROUP_SUFFIX

    // Copy Swift source files from watchos/CarelogWatch/ → ios/CarelogWatch/
    const srcDir = path.join(platformRoot, '..', 'watchos', WATCH_TARGET_NAME)
    const dstDir = path.join(platformRoot, WATCH_TARGET_NAME)
    if (!fs.existsSync(dstDir)) {
      fs.mkdirSync(dstDir, { recursive: true })
    }
    const swiftFiles = fs.readdirSync(srcDir).filter((f) => f.endsWith('.swift'))
    for (const file of swiftFiles) {
      fs.copyFileSync(path.join(srcDir, file), path.join(dstDir, file))
    }

    // Add the watchOS App native target
    const target = xcodeProject.addTarget(
      WATCH_TARGET_NAME,
      'watch2_app',
      WATCH_TARGET_NAME,
      watchBundleId,
    )

    // Add Sources build phase to the watch target
    xcodeProject.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', target.uuid)

    // Register each Swift file in the Sources build phase
    for (const file of swiftFiles) {
      xcodeProject.addSourceFile(
        path.join(WATCH_TARGET_NAME, file),
        { target: target.uuid },
      )
    }

    // Set watchOS-specific build settings
    const buildConfigs = xcodeProject.pbxXCBuildConfigurationSection()
    for (const key of Object.keys(buildConfigs)) {
      const cfg = buildConfigs[key]
      if (
        cfg &&
        typeof cfg === 'object' &&
        cfg.buildSettings &&
        cfg.buildSettings.PRODUCT_NAME === '"' + WATCH_TARGET_NAME + '"'
      ) {
        cfg.buildSettings.TARGETED_DEVICE_FAMILY             = '4'
        cfg.buildSettings.WATCHOS_DEPLOYMENT_TARGET          = "'7.0'"
        cfg.buildSettings.SWIFT_VERSION                      = "'5.0'"
        cfg.buildSettings.ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = 'YES'
      }
    }

    return mod
  })

  return config
}

export default withCarelogWatch
