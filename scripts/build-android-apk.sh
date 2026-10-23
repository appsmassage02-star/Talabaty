#!/bin/bash
# ==============================================================================
# Script: build-android-apk.sh
# Description: Fully automated build script to generate signed Android Release APK
# ==============================================================================

set -e

echo "🚀 Starting Android APK Build for Home Ai..."

# 1. Install required packages
echo "📦 1/5 Installing required Capacitor & build packages..."
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/app@^7.0.0 @capacitor/browser@^7.0.0 @capacitor/push-notifications@^7.0.7 --include=optional

# 2. Build Web Assets
echo "⚡ 2/5 Building Web Assets with Vite..."
npm run build

# 3. Initialize & Sync Capacitor Android
echo "📱 3/5 Initializing and Syncing Android platform..."
if [ ! -d "android" ]; then
  npx cap add android
fi
npx cap sync android

# 4. Prepare Keystore & Signing Configuration
echo "🔑 4/5 Setting up Keystore and Gradle Signing..."
node scripts/prepare-keystore.cjs

# 5. Build with Gradle
echo "🛠️  5/5 Building Android APKs using Gradle..."
cd android
chmod +x gradlew
./gradlew assembleRelease assembleDebug

cd ..

# 6. Finalize & Sign
node scripts/sign-apk.cjs

echo ""
echo "🎉 Build finished successfully!"
echo "📁 Output APKs:"
find android/app/build/outputs/apk -name "*.apk"
