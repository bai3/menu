#!/bin/bash
# Dependency-free debug APK builder using the Android SDK, useful for offline builds.
set -euo pipefail
cd "$(dirname "$0")"
: "${ANDROID_HOME:?Set ANDROID_HOME to your Android SDK directory}"
: "${JAVA_HOME:?Set JAVA_HOME to JDK 17 or newer (Android Studio includes one)}"
export PATH="$JAVA_HOME/bin:$PATH"
SDK_PLATFORM="${SDK_PLATFORM:-android-36}"
SDK_BUILD_TOOLS="${SDK_BUILD_TOOLS:-36.0.0}"
TOOLS="$ANDROID_HOME/build-tools/$SDK_BUILD_TOOLS"
ANDROID_JAR="$ANDROID_HOME/platforms/$SDK_PLATFORM/android.jar"
OUT="$PWD/app/build/sdk-debug"
rm -rf "$OUT"
mkdir -p "$OUT/gen/com/bai/jiayan" "$OUT/classes" "$OUT/dex"
"$TOOLS/aapt2" compile --dir app/src/main/res -o "$OUT/resources.zip"
sed 's/<manifest /<manifest package="com.bai.jiayan" /' app/src/main/AndroidManifest.xml > "$OUT/AndroidManifest.xml"
"$TOOLS/aapt2" link -o "$OUT/base.apk" --manifest "$OUT/AndroidManifest.xml" \
    -I "$ANDROID_JAR" --java "$OUT/gen" --min-sdk-version 26 --target-sdk-version 35 \
    --version-code 2 --version-name 1.0.1 --rename-manifest-package com.bai.jiayan "$OUT/resources.zip"
cat > "$OUT/gen/com/bai/jiayan/BuildConfig.java" <<'JAVA'
package com.bai.jiayan;
public final class BuildConfig {
    public static final boolean DEBUG = true;
    public static final String WEB_URL = "https://bai3.github.io/menu/";
}
JAVA
find app/src/main/java "$OUT/gen" -name '*.java' > "$OUT/sources.txt"
javac --release 17 -classpath "$ANDROID_JAR" -d "$OUT/classes" @"$OUT/sources.txt"
jar cf "$OUT/classes.jar" -C "$OUT/classes" .
"$TOOLS/d8" --lib "$ANDROID_JAR" --min-api 26 --output "$OUT/dex" "$OUT/classes.jar"
cp "$OUT/base.apk" "$OUT/unsigned.apk"
(cd "$OUT/dex" && zip -q "$OUT/unsigned.apk" classes*.dex)
"$TOOLS/zipalign" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"
# Keep this local test certificate to allow future APKs from this builder to upgrade in place.
# It is intentionally excluded from git; use a backed-up release key for distribution.
KEYSTORE="$PWD/debug.keystore"
if [[ ! -f "$KEYSTORE" ]]; then
    keytool -genkeypair -keystore "$KEYSTORE" -storepass android -keypass android \
        -alias androiddebugkey -dname 'CN=Android Debug,O=Android,C=US' \
        -keyalg RSA -keysize 2048 -validity 10000
fi
"$TOOLS/apksigner" sign --ks "$KEYSTORE" --ks-pass pass:android --key-pass pass:android \
    --out "$OUT/jiayan.apk" "$OUT/aligned.apk"
"$TOOLS/apksigner" verify "$OUT/jiayan.apk"
echo "APK: $OUT/jiayan.apk"
