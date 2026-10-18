const fs = require('fs');
const path = 'android/app/build.gradle';
let s = fs.readFileSync(path, 'utf8');

if (!s.includes("storeFile file('release.keystore')")) {
  s = s.replace(
    'signingConfigs {',
    `signingConfigs {
        release {
            storeFile file('release.keystore')
            storePassword System.getenv('KEYSTORE_PASSWORD')
            keyAlias System.getenv('KEY_ALIAS')
            keyPassword System.getenv('KEY_PASSWORD')
        }`
  );
  s = s.replace(
    /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
    '$1signingConfig signingConfigs.release'
  );
}

fs.writeFileSync(path, s);
console.log('Release signing configured.');