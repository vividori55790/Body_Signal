package com.bodysignal.app;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import androidx.activity.result.ActivityResult;
import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.util.concurrent.Executor;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "SecureAuth")
public class SecureAuthPlugin extends Plugin {
    private static final String ANDROID_KEYSTORE = "AndroidKeyStore";
    private static final String BIO_KEY_ALIAS = "bignal_bio_pin_key";
    private static final String DEVICE_KEY_ALIAS = "bignal_device_wrap_key";
    private static final String PREFS_NAME = "bignal_secure_keystore_prefs";
    private static final String PREF_BIO_CT = "bio_pin_ct";
    private static final String PREF_BIO_IV = "bio_pin_iv";
    private static final String PREF_BIO_MODE = "bio_auth_mode"; // "keystore_auth" | "legacy_keyguard"
    private static final String PREF_BIO_ENROLLED_AT = "bio_enrolled_at";
    private static final String PREF_DEVICE_KEY_CT = "device_key_ct";
    private static final String PREF_DEVICE_KEY_IV = "device_key_iv";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_TAG_BITS = 128;

    private SharedPreferences getPrefs() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private boolean isStrongBiometricAvailable() {
        BiometricManager manager = BiometricManager.from(getContext());
        return manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)
            == BiometricManager.BIOMETRIC_SUCCESS;
    }

    private boolean isDeviceCredentialAvailable() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            BiometricManager manager = BiometricManager.from(getContext());
            int status = manager.canAuthenticate(
                BiometricManager.Authenticators.BIOMETRIC_STRONG
                    | BiometricManager.Authenticators.DEVICE_CREDENTIAL
            );
            if (status == BiometricManager.BIOMETRIC_SUCCESS) {
                return true;
            }
        }
        KeyguardManager km = (KeyguardManager) getContext().getSystemService(Context.KEYGUARD_SERVICE);
        return km != null && km.isDeviceSecure();
    }

    private SecretKey getOrCreateBioKey(boolean recreate) throws Exception {
        KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
        keyStore.load(null);

        if (recreate && keyStore.containsAlias(BIO_KEY_ALIAS)) {
            keyStore.deleteEntry(BIO_KEY_ALIAS);
        }

        if (!keyStore.containsAlias(BIO_KEY_ALIAS)) {
            KeyGenerator keyGenerator = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES,
                ANDROID_KEYSTORE
            );
            KeyGenParameterSpec.Builder builder = new KeyGenParameterSpec.Builder(
                BIO_KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setUserAuthenticationRequired(true)
                .setInvalidatedByBiometricEnrollment(true);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                builder.setUserAuthenticationParameters(
                    0,
                    KeyProperties.AUTH_BIOMETRIC_STRONG | KeyProperties.AUTH_DEVICE_CREDENTIAL
                );
            }

            keyGenerator.init(builder.build());
            return keyGenerator.generateKey();
        }

        return ((KeyStore.SecretKeyEntry) keyStore.getEntry(BIO_KEY_ALIAS, null)).getSecretKey();
    }

    private SecretKey getOrCreateDeviceWrapKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
        keyStore.load(null);

        if (!keyStore.containsAlias(DEVICE_KEY_ALIAS)) {
            KeyGenerator keyGenerator = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES,
                ANDROID_KEYSTORE
            );
            KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
                DEVICE_KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setUserAuthenticationRequired(false)
                .build();
            keyGenerator.init(spec);
            return keyGenerator.generateKey();
        }

        return ((KeyStore.SecretKeyEntry) keyStore.getEntry(DEVICE_KEY_ALIAS, null)).getSecretKey();
    }

    private void clearBioState() {
        getPrefs().edit()
            .remove(PREF_BIO_CT)
            .remove(PREF_BIO_IV)
            .remove(PREF_BIO_MODE)
            .remove(PREF_BIO_ENROLLED_AT)
            .apply();
        try {
            KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
            keyStore.load(null);
            if (keyStore.containsAlias(BIO_KEY_ALIAS)) {
                keyStore.deleteEntry(BIO_KEY_ALIAS);
            }
        } catch (Exception ignored) {
        }
    }

    @PluginMethod
    public void isBiometricAvailable(PluginCall call) {
        boolean strong = isStrongBiometricAvailable();
        boolean deviceCred = isDeviceCredentialAvailable();
        JSObject ret = new JSObject();
        ret.put("available", strong || deviceCred);
        ret.put("strongBiometric", strong);
        ret.put("deviceCredential", deviceCred);
        call.resolve(ret);
    }

    @PluginMethod
    public void isBiometricEnrolled(PluginCall call) {
        SharedPreferences prefs = getPrefs();
        boolean enrolled = prefs.contains(PREF_BIO_CT) && prefs.contains(PREF_BIO_IV);
        JSObject ret = new JSObject();
        ret.put("enrolled", enrolled);
        ret.put("enrolledAt", prefs.getString(PREF_BIO_ENROLLED_AT, ""));
        ret.put("mode", prefs.getString(PREF_BIO_MODE, "keystore_auth"));
        call.resolve(ret);
    }

    @PluginMethod
    public void enrollBiometricPin(PluginCall call) {
        String pin = call.getString("pin");
        if (pin == null || pin.isEmpty()) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            call.resolve(ret);
            return;
        }

        if (!(getActivity() instanceof FragmentActivity)) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            call.resolve(ret);
            return;
        }

        String title = call.getString("title", "생체인증 / 기기 잠금 등록");
        String subtitle = call.getString("subtitle", "안드로이드에 저장된 지문·PIN·비밀번호로 잠금을 보호합니다.");
        String negativeButtonText = call.getString("negativeButtonText", "취소");

        // API 30+: Unified BiometricStrong + DeviceCredential hardware-backed CryptoObject
        // API 24-29 with strong biometric: Strong biometric CryptoObject
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R || isStrongBiometricAvailable()) {
            try {
                SecretKey key = getOrCreateBioKey(true);
                Cipher cipher = Cipher.getInstance(TRANSFORMATION);
                cipher.init(Cipher.ENCRYPT_MODE, key);

                FragmentActivity activity = (FragmentActivity) getActivity();
                activity.runOnUiThread(() -> {
                    Executor executor = ContextCompat.getMainExecutor(getContext());
                    BiometricPrompt prompt = new BiometricPrompt(
                        activity,
                        executor,
                        new BiometricPrompt.AuthenticationCallback() {
                            @Override
                            public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                                super.onAuthenticationSucceeded(result);
                                try {
                                    Cipher authCipher = result.getCryptoObject() != null
                                        ? result.getCryptoObject().getCipher()
                                        : null;
                                    if (authCipher == null) {
                                        JSObject ret = new JSObject();
                                        ret.put("success", false);
                                        call.resolve(ret);
                                        return;
                                    }

                                    byte[] encrypted = authCipher.doFinal(pin.getBytes(StandardCharsets.UTF_8));
                                    byte[] iv = authCipher.getIV();

                                    getPrefs().edit()
                                        .putString(PREF_BIO_CT, Base64.encodeToString(encrypted, Base64.NO_WRAP))
                                        .putString(PREF_BIO_IV, Base64.encodeToString(iv, Base64.NO_WRAP))
                                        .putString(PREF_BIO_MODE, "keystore_auth")
                                        .putString(PREF_BIO_ENROLLED_AT, String.valueOf(System.currentTimeMillis()))
                                        .apply();

                                    JSObject ret = new JSObject();
                                    ret.put("success", true);
                                    call.resolve(ret);
                                } catch (Exception e) {
                                    clearBioState();
                                    JSObject ret = new JSObject();
                                    ret.put("success", false);
                                    call.resolve(ret);
                                }
                            }

                            @Override
                            public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                                super.onAuthenticationError(errorCode, errString);
                                JSObject ret = new JSObject();
                                ret.put("success", false);
                                ret.put("errorCode", errorCode);
                                call.resolve(ret);
                            }
                        }
                    );

                    BiometricPrompt.PromptInfo.Builder promptBuilder = new BiometricPrompt.PromptInfo.Builder()
                        .setTitle(title)
                        .setSubtitle(subtitle);

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        promptBuilder.setAllowedAuthenticators(
                            BiometricManager.Authenticators.BIOMETRIC_STRONG
                                | BiometricManager.Authenticators.DEVICE_CREDENTIAL
                        );
                    } else {
                        promptBuilder
                            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                            .setNegativeButtonText(negativeButtonText);
                    }

                    prompt.authenticate(promptBuilder.build(), new BiometricPrompt.CryptoObject(cipher));
                });
                return;
            } catch (Exception e) {
                clearBioState();
                JSObject ret = new JSObject();
                ret.put("success", false);
                call.resolve(ret);
                return;
            }
        }

        // API 24-29 without strong biometric: fall back to OS ConfirmDeviceCredential + AndroidKeyStore device wrap key
        KeyguardManager km = (KeyguardManager) getContext().getSystemService(Context.KEYGUARD_SERVICE);
        if (km != null && km.isDeviceSecure()) {
            @SuppressWarnings("deprecation")
            Intent intent = km.createConfirmDeviceCredentialIntent(title, subtitle);
            if (intent != null) {
                startActivityForResult(call, intent, "onLegacyEnrollCredentialResult");
                return;
            }
        }

        JSObject ret = new JSObject();
        ret.put("success", false);
        call.resolve(ret);
    }

    @ActivityCallback
    private void onLegacyEnrollCredentialResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            call.resolve(ret);
            return;
        }
        String pin = call.getString("pin");
        if (pin == null || pin.isEmpty()) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            call.resolve(ret);
            return;
        }
        try {
            SecretKey wrapKey = getOrCreateDeviceWrapKey();
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, wrapKey);
            byte[] encrypted = cipher.doFinal(pin.getBytes(StandardCharsets.UTF_8));
            byte[] iv = cipher.getIV();

            getPrefs().edit()
                .putString(PREF_BIO_CT, Base64.encodeToString(encrypted, Base64.NO_WRAP))
                .putString(PREF_BIO_IV, Base64.encodeToString(iv, Base64.NO_WRAP))
                .putString(PREF_BIO_MODE, "legacy_keyguard")
                .putString(PREF_BIO_ENROLLED_AT, String.valueOf(System.currentTimeMillis()))
                .apply();

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            clearBioState();
            JSObject ret = new JSObject();
            ret.put("success", false);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void authenticateBiometricPin(PluginCall call) {
        SharedPreferences prefs = getPrefs();
        String ctB64 = prefs.getString(PREF_BIO_CT, null);
        String ivB64 = prefs.getString(PREF_BIO_IV, null);
        String mode = prefs.getString(PREF_BIO_MODE, "keystore_auth");

        if (ctB64 == null || ivB64 == null || !(getActivity() instanceof FragmentActivity)) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            call.resolve(ret);
            return;
        }

        String title = call.getString("title", "생체인증 / 기기 잠금 해제");
        String subtitle = call.getString("subtitle", "건강 데이터 접근을 위해 안드로이드 본인 인증이 필요합니다.");
        String negativeButtonText = call.getString("negativeButtonText", "앱 PIN 입력");

        if ("legacy_keyguard".equals(mode)) {
            KeyguardManager km = (KeyguardManager) getContext().getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null && km.isDeviceSecure()) {
                @SuppressWarnings("deprecation")
                Intent intent = km.createConfirmDeviceCredentialIntent(title, subtitle);
                if (intent != null) {
                    startActivityForResult(call, intent, "onLegacyAuthCredentialResult");
                    return;
                }
            }
            JSObject ret = new JSObject();
            ret.put("success", false);
            call.resolve(ret);
            return;
        }

        try {
            SecretKey key = getOrCreateBioKey(false);
            byte[] iv = Base64.decode(ivB64, Base64.NO_WRAP);
            byte[] ct = Base64.decode(ctB64, Base64.NO_WRAP);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));

            FragmentActivity activity = (FragmentActivity) getActivity();
            activity.runOnUiThread(() -> {
                Executor executor = ContextCompat.getMainExecutor(getContext());
                BiometricPrompt prompt = new BiometricPrompt(
                    activity,
                    executor,
                    new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                            super.onAuthenticationSucceeded(result);
                            try {
                                Cipher authCipher = result.getCryptoObject() != null
                                    ? result.getCryptoObject().getCipher()
                                    : null;
                                if (authCipher == null) {
                                    JSObject ret = new JSObject();
                                    ret.put("success", false);
                                    call.resolve(ret);
                                    return;
                                }

                                byte[] plainBytes = authCipher.doFinal(ct);
                                String pin = new String(plainBytes, StandardCharsets.UTF_8);

                                JSObject ret = new JSObject();
                                ret.put("success", true);
                                ret.put("pin", pin);
                                call.resolve(ret);
                            } catch (Exception e) {
                                JSObject ret = new JSObject();
                                ret.put("success", false);
                                call.resolve(ret);
                            }
                        }

                        @Override
                        public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                            super.onAuthenticationError(errorCode, errString);
                            JSObject ret = new JSObject();
                            ret.put("success", false);
                            ret.put("errorCode", errorCode);
                            call.resolve(ret);
                        }
                    }
                );

                BiometricPrompt.PromptInfo.Builder promptBuilder = new BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title)
                    .setSubtitle(subtitle);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    promptBuilder.setAllowedAuthenticators(
                        BiometricManager.Authenticators.BIOMETRIC_STRONG
                            | BiometricManager.Authenticators.DEVICE_CREDENTIAL
                    );
                } else {
                    promptBuilder
                        .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                        .setNegativeButtonText(negativeButtonText);
                }

                prompt.authenticate(promptBuilder.build(), new BiometricPrompt.CryptoObject(cipher));
            });
        } catch (KeyPermanentlyInvalidatedException invalidEx) {
            clearBioState();
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("invalidated", true);
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            call.resolve(ret);
        }
    }

    @ActivityCallback
    private void onLegacyAuthCredentialResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            call.resolve(ret);
            return;
        }
        SharedPreferences prefs = getPrefs();
        String ctB64 = prefs.getString(PREF_BIO_CT, null);
        String ivB64 = prefs.getString(PREF_BIO_IV, null);
        if (ctB64 == null || ivB64 == null) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            call.resolve(ret);
            return;
        }
        try {
            SecretKey wrapKey = getOrCreateDeviceWrapKey();
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(
                Cipher.DECRYPT_MODE,
                wrapKey,
                new GCMParameterSpec(GCM_TAG_BITS, Base64.decode(ivB64, Base64.NO_WRAP))
            );
            byte[] plain = cipher.doFinal(Base64.decode(ctB64, Base64.NO_WRAP));
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("pin", new String(plain, StandardCharsets.UTF_8));
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void clearBiometricPin(PluginCall call) {
        clearBioState();
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void getOrCreateDeviceMasterKeyHex(PluginCall call) {
        try {
            SharedPreferences prefs = getPrefs();
            SecretKey wrapKey = getOrCreateDeviceWrapKey();
            String ctB64 = prefs.getString(PREF_DEVICE_KEY_CT, null);
            String ivB64 = prefs.getString(PREF_DEVICE_KEY_IV, null);

            if (ctB64 != null && ivB64 != null) {
                Cipher cipher = Cipher.getInstance(TRANSFORMATION);
                cipher.init(
                    Cipher.DECRYPT_MODE,
                    wrapKey,
                    new GCMParameterSpec(GCM_TAG_BITS, Base64.decode(ivB64, Base64.NO_WRAP))
                );
                byte[] plain = cipher.doFinal(Base64.decode(ctB64, Base64.NO_WRAP));
                JSObject ret = new JSObject();
                ret.put("hexKey", new String(plain, StandardCharsets.UTF_8));
                call.resolve(ret);
                return;
            }

            // Migrate pre-upgrade key into AndroidKeyStore once if provided, otherwise generate new 256-bit random key
            String migrateHex = call.getString("migrateHexKey");
            String hexKey;
            if (migrateHex != null && migrateHex.matches("^[0-9a-fA-F]{64}$")) {
                hexKey = migrateHex;
            } else {
                byte[] rawBytes = new byte[32];
                new SecureRandom().nextBytes(rawBytes);
                StringBuilder sb = new StringBuilder(64);
                for (byte b : rawBytes) {
                    sb.append(String.format("%02x", b));
                }
                hexKey = sb.toString();
            }

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, wrapKey);
            byte[] encrypted = cipher.doFinal(hexKey.getBytes(StandardCharsets.UTF_8));
            byte[] iv = cipher.getIV();

            prefs.edit()
                .putString(PREF_DEVICE_KEY_CT, Base64.encodeToString(encrypted, Base64.NO_WRAP))
                .putString(PREF_DEVICE_KEY_IV, Base64.encodeToString(iv, Base64.NO_WRAP))
                .apply();

            JSObject ret = new JSObject();
            ret.put("hexKey", hexKey);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("AndroidKeyStore device key error", e);
        }
    }

    @PluginMethod
    public void clearAllHardwareSecrets(PluginCall call) {
        clearBioState();
        getPrefs().edit().clear().apply();
        try {
            KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
            keyStore.load(null);
            if (keyStore.containsAlias(DEVICE_KEY_ALIAS)) {
                keyStore.deleteEntry(DEVICE_KEY_ALIAS);
            }
        } catch (Exception ignored) {
        }
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }
}
