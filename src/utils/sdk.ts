import { Platform } from "react-native";
import { VersionSDK } from "@codeimplants/version-control";
import { VITE_VC_DEBUG } from "@config";
import { getBundleId, getVersionName } from "./appVersion";
import {
    getVersionControlConfig,
    hasVersionControlConfig,
    hydrateVersionControlConfig,
    onVersionControlConfigChange,
    type VersionControlConfig,
} from "./versionControlConfig";

// VersionSDK.init captures the URL and key at construction, so the client is
// rebuilt whenever the resolved config changes (cache hydration, or a fresh
// /api/platform/config response) rather than being created once at import.
let client = build(getVersionControlConfig());

function build(cfg: VersionControlConfig) {
    // Version and appId are both passed in rather than left to the SDK's
    // auto-detection, on every platform, because that detection is wrong here
    // and silently so.
    //
    // Its chain tries a bundled VCAppInfo native module first, then expo-*, then
    // react-native-device-info. VCAppInfo only ships for Android — the npm
    // package has no iOS podspec — so on iOS the chain reached expo-constants,
    // which returns the *expo app config* version. That is generated at build
    // time from package.json, which sits at 0.0.1 and always will. So every iOS
    // install reported 0.0.1, fell below every Nexus rule, and was told to
    // update forever: updating changed nothing it reported, and the store had
    // nothing to offer because it was already current. Only switching the rule
    // off stopped it.
    //
    // Android happened to be safe purely because VCAppInfo linked there and won
    // the race. That is one autolink failure away from the same bug, so both
    // platforms are pinned here instead.
    //
    // appId is pinned for the same reason even though it currently resolves
    // correctly: expo-constants only yields nothing for it because our app.json
    // carries no expo.ios.bundleIdentifier / expo.android.package. Adding either
    // key — the sort of thing a library's setup guide asks for — would silently
    // start answering appId from project metadata too, and appId is what Nexus
    // identifies the app by when no API key resolves, i.e. the thing that keeps
    // the kill switch reachable on a broken build.
    //
    // Both accessors read the installed binary: versionName / CFBundleShortVersionString
    // and packageName / CFBundleIdentifier.
    return VersionSDK.init({
        backendUrl: cfg.backendUrl,
        apiKey: cfg.apiKey,
        debug: VITE_VC_DEBUG,
        version: getVersionName() ?? undefined,
        appId: getBundleId() ?? undefined,
    });
}

onVersionControlConfigChange(cfg => {
    client = build(cfg);
});

export const getDecision = async () => {
    // The version-check backend only accepts android/ios; skip the call on
    // any other platform (e.g. web) instead of making a request that will 400.
    if (Platform.OS !== "android" && Platform.OS !== "ios") {
        return null;
    }

    // Prefer the cached config over whatever was compiled in. This runs at
    // launch, before /api/platform/config has returned, so without it a bad
    // compiled key would break the check on every cold start.
    await hydrateVersionControlConfig();

    if (!hasVersionControlConfig()) {
        // Nexus still identifies the app by its package name, which build()
        // pins from the installed binary and sends regardless, so the check is
        // worth making: force-update and the kill switch keep working without
        // a key.
        console.warn(
            "[VC] No version-control API key resolved — falling back to package-name identification. " +
            "Version control will work; engagement telemetry will not.",
        );
    }

    return client.checkVersion();
};
