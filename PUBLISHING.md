# MIRAY - Publishing Guide

Step-by-step guide to publish packages to NPM.

## Preparation

### 1. Check NPM Account

```bash
# Check if you're logged in to NPM
npm whoami

# If not logged in:
npm login

# Enter your credentials:
# Username: yasaricli (or your NPM username)
# Password: ***
# Email: (your email)
# OTP: (if 2FA is enabled)
```

### 2. Check Package Name Availability

```bash
# Check each package
npm view miray-common
npm view miray-server
npm view miray-client
npm view miray-cli

# If you get "npm ERR! 404", the name is available ✅
# If you see package info, the name is taken ❌
```

### 3. Clean and Build

```bash
# Clean up
make clean-all

# Reinstall dependencies
npm install

# Test (if available)
npm run test

# Build (if available)
npm run build
```

## Publishing Methods

### Method 1: Publish All Packages with Lerna (RECOMMENDED)

```bash
# 1. Bump version (all packages)
npm run version

# It will ask:
# ? Select a new version (currently 0.0.1)
#   Patch (0.0.2)
#   Minor (0.1.0)
# > Major (1.0.0)

# 2. Publish
npm run publish

# Lerna will ask:
# ? Are you sure you want to publish these packages?
#   - miray-common => 0.0.2
#   - miray-server => 0.0.2
#   - miray-client => 0.0.2
#   - miray-cli => 0.0.2
# (Y/n)
```

### Method 2: Manually Publish One by One

```bash
# miray-common
cd packages/common
npm publish --access public

# miray-server
cd packages/server
npm publish --access public

# miray-client
cd packages/client
npm publish --access public

# miray-cli
cd packages/cli
npm publish --access public
```

### Method 3: Using Makefile

```bash
# Version bump
make version

# Publish
make publish
```

## First Time Publishing (v0.0.1 → v1.0.0)

```bash
# 1. Set version to 1.0.0
npx lerna version 1.0.0 --no-git-tag-version

# 2. Publish
npx lerna publish from-package

# 3. Commit to Git
git add .
git commit -m "chore: publish v1.0.0"
git push
```

## Post-Publish Verification

```bash
# Check packages on NPM
npm view miray-common
npm view miray-server
npm view miray-client
npm view miray-cli

# Install for testing
npm install -g miray-server
npm install -g miray-cli

# Test
miray-server --help
miray --help
```

## Update Scenarios

### Patch Update (0.0.1 → 0.0.2)

For bug fixes:

```bash
npm run version -- patch
npm run publish
```

### Minor Update (0.0.1 → 0.1.0)

For new features (backward compatible):

```bash
npm run version -- minor
npm run publish
```

### Major Update (0.0.1 → 1.0.0)

For breaking changes:

```bash
npm run version -- major
npm run publish
```

## Troubleshooting

### Problem: "You must be logged in to publish packages"

```bash
npm login
npm whoami  # Kontrol
```

### Problem: "Package name already taken"

İsmi değiştirmeniz gerekiyor:
```bash
# packages/*/package.json dosyalarında ismi değiştirin
# Örneğin: miray-server → @yasaricli/miray-server
```

### Problem: "You do not have permission to publish"

```bash
# Access public olmalı (scoped package için)
npm publish --access public
```

### Problem: "402 Payment Required"

Bu paket ismi premium olabilir, farklı bir isim deneyin.

### Problem: Published but not showing

```bash
# NPM cache temizle
npm cache clean --force

# Birkaç dakika bekleyin, NPM propagate olsun
```

## Git Tag'leme

Lerna otomatik tag oluşturur, ama manuel yapmak isterseniz:

```bash
git tag v1.0.0
git push origin v1.0.0
```

## NPM Badge'ler

README'nize ekleyebileceğiniz badge'ler:

```markdown
[![npm version](https://badge.fury.io/js/miray-server.svg)](https://www.npmjs.com/package/miray-server)
[![npm downloads](https://img.shields.io/npm/dm/miray-server.svg)](https://www.npmjs.com/package/miray-server)
```

## Unpublish (İptal Etme)

⚠️ Dikkatli kullanın! İlk 72 saat içinde:

```bash
npm unpublish miray-server@1.0.0
```

## Checklist

Publish öncesi kontrol listesi:

- [ ] NPM'e login yapıldı (`npm whoami`)
- [ ] Paket isimleri müsait
- [ ] Version numarası doğru (0.0.1 veya 1.0.0)
- [ ] README dosyaları hazır
- [ ] Repository bilgileri doğru
- [ ] `publishConfig.access: "public"` ayarlandı
- [ ] Dependencies doğru
- [ ] .npmignore oluşturuldu
- [ ] Test edildi (varsa)
- [ ] Git commit'lendi

## Hızlı Komutlar

```bash
# Kontrol
npm whoami
npm view miray-server

# Publish
npm run version
npm run publish

# Doğrulama
npm view miray-server
npm install -g miray-server
miray-server --help
```

## Sonraki Adımlar

Publish sonrası:

1. GitHub'da release oluşturun
2. README'ye NPM badge ekleyin
3. Changelog güncelleyin
4. Social media'da duyurun 🎉
