#!/bin/bash
# ==============================================================================
# Script: generate-keystore.sh
# Description: Generates a high-security Android release Keystore
# ==============================================================================

set -e

KEYSTORE_DIR="./android/keystores"
KEYSTORE_PATH="${KEYSTORE_DIR}/release.jks"
KEY_ALIAS="${KEY_ALIAS:-Mohamed Abo Taleb}"
ORGANIZATION="Home Ai"
COUNTRY="EG"
VALIDITY_DAYS=10000

if [ -z "$KEYSTORE_PASSWORD" ]; then
  echo "Error: KEYSTORE_PASSWORD environment variable is required to generate the release keystore."
  exit 1
fi

KEY_PASSWORD="${KEY_PASSWORD:-$KEYSTORE_PASSWORD}"

mkdir -p "$KEYSTORE_DIR"

if [ -f "$KEYSTORE_PATH" ]; then
  echo "Keystore already exists at: $KEYSTORE_PATH"
else
  echo "Generating official release keystore..."
  keytool -genkeypair -v \
    -keystore "$KEYSTORE_PATH" \
    -alias "$KEY_ALIAS" \
    -keyalg RSA \
    -keysize 2048 \
    -validity "$VALIDITY_DAYS" \
    -storepass "$KEYSTORE_PASSWORD" \
    -keypass "$KEY_PASSWORD" \
    -dname "CN=Mohamed Abo Taleb, OU=Home Ai Mobile Division, O=Home Ai, L=Cairo, ST=Cairo, C=EG"

  echo "Keystore successfully generated at: $KEYSTORE_PATH"
fi

# Write keystore.properties for gradle integration
cat <<EOF > android/keystore.properties
storePassword=$KEYSTORE_PASSWORD
keyPassword=$KEY_PASSWORD
keyAlias=$KEY_ALIAS
storeFile=../keystores/release.jks
EOF

echo "Keystore properties configured successfully."
