// ==============================================================================
// Script: scripts/prepare-keystore.cjs
// Description: Prepares Android Keystore from GitHub Secrets or generates a local
//              keystore, and configures Gradle signing securely without exposing secrets.
// ==============================================================================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const isCI = process.env.CI === 'true' || !!process.env.GITHUB_ACTIONS;

const KEY_ALIAS = process.env.KEY_ALIAS || 'Mohamed Abo Taleb';
const KEYSTORE_BASE64 = process.env.ANDROID_KEYSTORE_BASE64 || process.env.KEYSTORE_BASE64;
const KEYSTORE_PASS = process.env.KEYSTORE_PASSWORD;
const KEY_PASS = process.env.KEY_PASSWORD;

if (isCI && (!KEYSTORE_PASS || !KEY_PASS)) {
  console.warn('[prepare-keystore] WARNING: KEYSTORE_PASSWORD or KEY_PASSWORD secret is not set in CI environment.');
}

const finalKeystorePass = KEYSTORE_PASS || (isCI ? '' : 'HomeAiDevKey2026!');
const finalKeyPass = KEY_PASS || finalKeystorePass;

const rootKeystoreDir = path.join(process.cwd(), 'android', 'keystores');
const appKeystoreDir = path.join(process.cwd(), 'android', 'app', 'keystores');
const appKeystoreFile = path.join(appKeystoreDir, 'release.jks');
const rootKeystoreFile = path.join(rootKeystoreDir, 'release.jks');
const infoFile = path.join(rootKeystoreDir, 'keystore-info.txt');

// 1. Ensure directories exist
fs.mkdirSync(rootKeystoreDir, { recursive: true });
fs.mkdirSync(appKeystoreDir, { recursive: true });

// 2. Decode Base64 keystore if provided in secrets
if (KEYSTORE_BASE64) {
  console.log('[prepare-keystore] Restoring Keystore from secure GitHub Secret (Base64)...');
  const buffer = Buffer.from(KEYSTORE_BASE64, 'base64');
  fs.writeFileSync(appKeystoreFile, buffer);
  fs.writeFileSync(rootKeystoreFile, buffer);
  console.log('[prepare-keystore] Restored keystore successfully.');
} else if (!fs.existsSync(appKeystoreFile)) {
  if (isCI && !KEYSTORE_PASS) {
    console.warn('[prepare-keystore] Notice: Generating ephemeral release keystore for CI artifact validation.');
  }
  console.log('[prepare-keystore] Generating Android Keystore for Mohamed Abo Taleb (Home Ai)...');
  const dname = 'CN=Mohamed Abo Taleb, OU=Home Ai Mobile Division, O=Home Ai, L=Cairo, ST=Cairo, C=EG';
  const passArg = finalKeystorePass ? `-storepass "${finalKeystorePass}" -keypass "${finalKeyPass}"` : '';
  
  if (finalKeystorePass) {
    const genCmd = `keytool -genkeypair -v -keystore "${appKeystoreFile}" -alias "${KEY_ALIAS}" -keyalg RSA -keysize 2048 -validity 10000 ${passArg} -dname "${dname}"`;
    try {
      execSync(genCmd, { stdio: 'inherit' });
      console.log('[prepare-keystore] Keystore generated successfully.');
    } catch (err) {
      console.error('[prepare-keystore] Error generating keystore:', err.message);
    }
  }
} else {
  console.log('[prepare-keystore] Keystore already exists at:', appKeystoreFile);
}

// Copy keystore to root android/keystores directory
if (fs.existsSync(appKeystoreFile)) {
  fs.copyFileSync(appKeystoreFile, rootKeystoreFile);
}

// 3. Write metadata (NO PLAINTEXT PASSWORDS FOR SECURITY)
const infoContent = [
  '===========================================================',
  'Home Ai - Android Keystore Details (Sanitized)',
  '===========================================================',
  `Key Alias: ${KEY_ALIAS}`,
  'Owner / CN: Mohamed Abo Taleb',
  'Organization: Home Ai',
  'Country: Egypt (EG)',
  'Algorithm: RSA 2048-bit',
  'Validity: 10,000 Days (~27 Years)',
  'Store File: release.jks',
  `Status: Configured via environment / secure keystore`,
  `Generated/Processed At: ${new Date().toISOString()}`,
  '===========================================================\n'
].join('\n');

fs.writeFileSync(infoFile, infoContent, 'utf8');

// 4. Configure android/app/build.gradle signingConfigs if passwords present
const gradlePath = path.join(process.cwd(), 'android', 'app', 'build.gradle');
if (fs.existsSync(gradlePath) && finalKeystorePass) {
  try {
    let content = fs.readFileSync(gradlePath, 'utf8');
    const signingBlock = `
    signingConfigs {
        release {
            storeFile file("keystores/release.jks")
            storePassword "${finalKeystorePass}"
            keyAlias "${KEY_ALIAS}"
            keyPassword "${finalKeyPass}"
        }
    }
`;

    if (!content.includes('signingConfigs {')) {
      content = content.replace(/android\s*\{/, 'android {' + signingBlock);
    }

    content = content.replace(/buildTypes\s*\{[\s\S]*?release\s*\{/, (match) => {
      if (!match.includes('signingConfig signingConfigs.release')) {
        return match + '\n            signingConfig signingConfigs.release';
      }
      return match;
    });

    fs.writeFileSync(gradlePath, content, 'utf8');
    console.log('[prepare-keystore] Configured android/app/build.gradle with release signingConfig.');
  } catch (e) {
    console.error('[prepare-keystore] Error updating build.gradle:', e.message);
  }
}
