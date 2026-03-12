import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * release.ts - Automated Version Bumping & Release Workflow
 * 
 * Catalyst: npm run release [patch|minor|major]
 * Logic:
 * 1. Read package.json
 * 2. Bump version (default: patch)
 * 3. Update package.json and package-lock.json
 * 4. Git commit version changes
 * 5. Git tag the release
 * 6. Git push commit and tag
 */

const projectRoot = path.join(__dirname, '..', '..');
const packageJsonPath = path.join(projectRoot, 'package.json');
const packageLockPath = path.join(projectRoot, 'package-lock.json');

function getNextVersion(current: string, type: 'patch' | 'minor' | 'major' = 'patch'): string {
    const parts = current.split('.').map(Number);
    if (parts.length !== 3) throw new Error(`Invalid version format: ${current}`);

    if (type === 'major') {
        parts[0]++;
        parts[1] = 0;
        parts[2] = 0;
    } else if (type === 'minor') {
        parts[1]++;
        parts[2] = 0;
    } else {
        parts[2]++;
    }

    return parts.join('.');
}

function runCommand(command: string) {
    console.log(`> ${command}`);
    try {
        execSync(command, { stdio: 'inherit', cwd: projectRoot });
    } catch (error) {
        console.error(`Command failed: ${command}`);
        process.exit(1);
    }
}

async function release() {
    const bumpType = (process.argv[2] as 'patch' | 'minor' | 'major') || 'patch';
    
    // 1. Read package.json
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const oldVersion = pkg.version;
    const newVersion = getNextVersion(oldVersion, bumpType);
    
    console.log(`🚀 Releasing v${newVersion} (from v${oldVersion})...`);

    // 2. Update package.json
    pkg.version = newVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`✅ Updated package.json`);

    // 3. Update package-lock.json
    if (fs.existsSync(packageLockPath)) {
        const lock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
        lock.version = newVersion;
        if (lock.packages && lock.packages['']) {
            lock.packages[''].version = newVersion;
        }
        fs.writeFileSync(packageLockPath, JSON.stringify(lock, null, 2) + '\n');
        console.log(`✅ Updated package-lock.json`);
    }

    // 4. Git Flow
    runCommand(`git add package.json package-lock.json`);
    runCommand(`git commit -m "chore: release v${newVersion}"`);
    runCommand(`git tag -a v${newVersion} -m "Release v${newVersion}"`);
    runCommand(`git push origin main`); // Assuming main, could be dynamic
    runCommand(`git push origin v${newVersion}`);

    console.log(`\n✨ Release v${newVersion} successfully deployed!`);
}

release().catch(err => {
    console.error(err);
    process.exit(1);
});
