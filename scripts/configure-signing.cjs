// ==============================================================================
// Script: scripts/configure-signing.cjs
// Description: Automatically configures Android signingConfigs for release APKs
//              using environment variables or secrets.
// ==============================================================================

const fs = require('fs');
const path = require('path');

const gradlePath = path.join(process.cwd(), 'android', 'app', 'build.gradle');

if (!fs.existsSync(gradlePath)) {
  console.log(`[configure-signing] File not found: ${gradlePath}, skipping.`);
  process.exit(0);
}

try {
  let content = fs.readFileSync(gradlePath, 'utf8');

  const keystorePass = process.env.KEYSTORE_PASSWORD;
  const keyPass = process.env.KEY_PASSWORD || keystorePass;
  const keyAlias = process.env.KEY_ALIAS || 'Mohamed Abo Taleb';

  if (keystorePass) {
    const signingBlock = `
    signingConfigs {
        release {
            storeFile file("keystores/release.jks")
            storePassword "${keystorePass}"
            keyAlias "${keyAlias}"
            keyPassword "${keyPass}"
        }
    }
`;

    // Add signingConfigs if not present
    if (!content.includes('signingConfigs {')) {
      content = content.replace(/android\s*\{/, 'android {' + signingBlock);
    }

    // Ensure release build type uses the release signing config
    content = content.replace(/buildTypes\s*\{[\s\S]*?release\s*\{/, (match) => {
      if (!match.includes('signingConfig signingConfigs.release')) {
        return match + '\n            signingConfig signingConfigs.release';
      }
      return match;
    });

    fs.writeFileSync(gradlePath, content, 'utf8');
    console.log('[configure-signing] Successfully injected release signingConfig into android/app/build.gradle');
  } else {
    console.log('[configure-signing] KEYSTORE_PASSWORD not provided; skipping build.gradle hardcoding.');
  }
} catch (error) {
  console.error('[configure-signing] Error modifying build.gradle:', error);
  process.exit(1);
}
