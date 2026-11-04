# License logic test
Compiles the license engine to a temp folder, swaps in a throw-away test public key (your real
`src/License/publicKey.ts` is NOT touched), signs keys with the matching test private key and
checks every rule (free, valid, expired, device, email, clock, tampering, prefix, whitespace).

    npx tsc --ignoreConfig --outDir /tmp/lt --rootDir src --module commonjs --moduleResolution node \
      --target es2020 --lib es2020,dom --skipLibCheck --esModuleInterop \
      src/License/LicenseEngine.ts src/License/DeviceFingerprint.ts
    ln -sfn "$PWD/node_modules" /tmp/lt/node_modules
    cp tools/test-license.cjs /tmp/lt/test.js && node /tmp/lt/test.js
