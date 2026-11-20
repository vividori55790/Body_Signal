package com.bodysignal.app;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Debug;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.InputStreamReader;
import java.util.Locale;

/**
 * Runtime device integrity assessment: detects rooted devices, Magisk/su binaries,
 * hooking frameworks (Frida/Xposed/LSPosed/Substrate), active debuggers, and debuggable
 * repackaging of release builds.
 *
 * Custom ROM / F-Droid policy: F-Droid official APKs run with standard release signing on
 * unmodified OS builds (`release-keys`), whereas AOSP emulator or unsigned development ROMs
 * report `Build.TAGS` containing `test-keys` and are intentionally rejected for sensitive
 * on-device medical records.
 */
public final class SecurityCheck {
    private SecurityCheck() {}

    public static final class Result {
        public final boolean secure;
        public final boolean rooted;
        public final boolean hooked;
        public final boolean debuggerAttached;
        public final String reason;

        Result(boolean secure, boolean rooted, boolean hooked, boolean debuggerAttached, String reason) {
            this.secure = secure;
            this.rooted = rooted;
            this.hooked = hooked;
            this.debuggerAttached = debuggerAttached;
            this.reason = reason;
        }
    }

    private static final String[] ROOT_BINARY_PATHS = {
        "/system/bin/su",
        "/system/xbin/su",
        "/sbin/su",
        "/system/sd/xbin/su",
        "/system/bin/failsafe/su",
        "/data/local/xbin/su",
        "/data/local/bin/su",
        "/data/local/su",
        "/su/bin/su",
        "/vendor/bin/su",
        "/system/app/Superuser.apk",
        "/sbin/.magisk",
        "/data/adb/magisk",
    };

    private static final String[] ROOT_PACKAGES = {
        "com.topjohnwu.magisk",
        "eu.chainfire.supersu",
        "com.noshufou.android.su",
        "com.koushikdutta.superuser",
        "com.thirdparty.superuser",
        "com.yellowes.su",
        "me.phh.superuser",
        "de.robv.android.xposed.installer",
        "org.lsposed.manager",
        "io.github.lsposed.manager",
    };

    private static final String[] HOOK_MARKERS = {
        "frida",
        "gum-js-loop",
        "xposed",
        "lsposed",
        "libsubstrate",
    };

    public static Result assessDevice(Context context) {
        boolean rooted = hasTestKeys() || hasRootBinary() || hasRootPackage(context) || canExecuteWhichSu();
        boolean hooked = hasHookingMaps();
        boolean debugger = Debug.isDebuggerConnected()
            || Debug.waitingForDebugger()
            || isTamperedDebuggableRelease(context);

        boolean isKo = Locale.getDefault().getLanguage().startsWith("ko");
        if (rooted) {
            return new Result(
                false,
                true,
                hooked,
                debugger,
                isKo
                    ? "루팅(Rooting) 또는 비공식(test-keys) 빌드가 감지되어 실행이 차단되었습니다."
                    : "Rooted environment or unofficial test-keys ROM detected. Launch blocked."
            );
        }
        if (hooked) {
            return new Result(
                false,
                false,
                true,
                debugger,
                isKo
                    ? "런타임 후킹/변조 프레임워크가 감지되어 실행이 차단되었습니다."
                    : "Runtime hooking or tampering framework detected. Launch blocked."
            );
        }
        if (debugger) {
            return new Result(
                false,
                false,
                false,
                true,
                isKo
                    ? "디버거 연결 또는 변조된 빌드가 감지되어 실행이 차단되었습니다."
                    : "Attached debugger or tampered build detected. Launch blocked."
            );
        }
        return new Result(true, false, false, false, "");
    }

    private static boolean hasTestKeys() {
        String tags = Build.TAGS;
        return tags != null && tags.contains("test-keys");
    }

    private static boolean hasRootBinary() {
        for (String path : ROOT_BINARY_PATHS) {
            try {
                if (new File(path).exists()) {
                    return true;
                }
            } catch (Exception ignored) {
            }
        }
        return false;
    }

    private static boolean hasRootPackage(Context context) {
        if (context == null) return false;
        PackageManager pm = context.getPackageManager();
        if (pm == null) return false;
        for (String pkg : ROOT_PACKAGES) {
            try {
                pm.getPackageInfo(pkg, 0);
                return true;
            } catch (PackageManager.NameNotFoundException ignored) {
            } catch (Exception ignored) {
            }
        }
        return false;
    }

    private static boolean canExecuteWhichSu() {
        Process process = null;
        try {
            process = Runtime.getRuntime().exec(new String[] { "/system/xbin/which", "su" });
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line = reader.readLine();
                return line != null && !line.trim().isEmpty();
            }
        } catch (Exception ignored) {
            return false;
        } finally {
            if (process != null) {
                process.destroy();
            }
        }
    }

    private static boolean hasHookingMaps() {
        File maps = new File("/proc/self/maps");
        if (!maps.exists() || !maps.canRead()) {
            return false;
        }
        try (BufferedReader reader = new BufferedReader(new FileReader(maps))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String lower = line.toLowerCase();
                for (String marker : HOOK_MARKERS) {
                    if (lower.contains(marker)) {
                        return true;
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return false;
    }

    private static boolean isTamperedDebuggableRelease(Context context) {
        if (context == null || BuildConfig.DEBUG) {
            return false;
        }
        ApplicationInfo info = context.getApplicationInfo();
        return info != null && (info.flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }
}
