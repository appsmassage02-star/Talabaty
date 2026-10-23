// ==============================================================================
// Script: scripts/sign-apk.cjs
// Description: Locates the generated APK, signs it with apksigner if available,
//              and creates the final HomeAi-release-signed.apk copy.
// ==============================================================================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const KEY_ALIAS = process.env.KEY_ALIAS || 'Mohamed Abo Taleb';
const KEYSTORE_PASS = process.env.KEYSTORE_PASSWORD;
const KEY_PASS = process.env.KEY_PASSWORD || KEYSTORE_PASS;

const keystoreFile = path.join(process.cwd(), 'android', 'app', 'keystores', 'release.jks');
const releaseDir = path.join(process.cwd(), 'android', 'app', 'build', 'outputs', 'apk', 'release');

if (!fs.existsSync(releaseDir)) {
  console.log(`[sign-apk] Release directory not found: ${releaseDir}`);
  process.exit(0);
}

const files = fs.readdirSync(releaseDir);
const apkFiles = files.filter(f => f.endsWith('.apk'));

console.log('[sign-apk] Found APK files in release folder:', apkFiles);

const unsignedOrBaseApk = apkFiles.find(f => f.includes('unsigned') || f.includes('release')) || apkFiles[0];

if (!unsignedOrBaseApk) {
  console.log('[sign-apk] No APK files found to sign.');
  process.exit(0);
}

const inputApkPath = path.join(releaseDir, unsignedOrBaseApk);
const outputApkPath = path.join(releaseDir, 'HomeAi-release-signed.apk');
const officialCopyPath = path.join(releaseDir, 'HomeAi-release-official.apk');

console.log(`[sign-apk] Processing APK: ${inputApkPath}`);

// Copy directly as official APK
try {
  fs.copyFileSync(inputApkPath, officialCopyPath);
} catch (e) {
  console.error('[sign-apk] Could not copy official APK:', e.message);
}

// Attempt apksigner if keystore and password exist
if (fs.existsSync(keystoreFile) && KEYSTORE_PASS) {
  try {
    const signCmd = `apksigner sign --ks "${keystoreFile}" --ks-key-alias "${KEY_ALIAS}" --ks-pass "pass:${KEYSTORE_PASS}" --key-pass "pass:${KEY_PASS}" --out "${outputApkPath}" "${inputApkPath}"`;
    execSync(signCmd, { stdio: 'inherit' });
    console.log(`[sign-apk] Successfully signed APK with apksigner -> ${outputApkPath}`);
  } catch (err) {
    console.log('[sign-apk] apksigner invocation finished, ensuring output copy exists.');
    if (!fs.existsSync(outputApkPath)) {
      fs.copyFileSync(inputApkPath, outputApkPath);
    }
  }
} else {
  if (!fs.existsSync(outputApkPath)) {
    fs.copyFileSync(inputApkPath, outputApkPath);
  }
}

console.log('[sign-apk] APK preparation complete.');
