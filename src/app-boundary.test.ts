import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// This app registers with the omnibar through the contract alone.
// Paths, not URLs: the test environment's URL is happy-dom's, which node:fs doesn't accept.
const appSource = dirname(fileURLToPath(import.meta.url));
const ownContract = join(appSource, 'omnibar-contract');
const allowedPackages = ['@openmrs/esm-framework', 'react', 'react-i18next', 'swr'];

// The omnibar's src/omnibar-contract as of pbiondich/openmrs-esm-omnibar-app commit 4ab87d8 (git tree
// 9a4d7a2). Never edit the copy: copy the omnibar's folder again and update this hash.
const contractCopySha256 = '21828b65370a675159532047bc674d283b6ca7f0371c4092fc6545b6faa1bbbf';

const filesUnder = (folder: string): Array<string> =>
  readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });

const isTest = (file: string) => /\.test\.tsx?$/.test(file);

const importsOf = (source: string) =>
  [...source.matchAll(/(?:from\s+|import\s*\(\s*|require(?:\.context)?\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)].map(
    ([, specifier]) => specifier,
  );

describe('the query store app', () => {
  const sourceFiles = filesUnder(appSource).filter((file) => /\.tsx?$/.test(file) && !isTest(file));

  it('imports only its own files, its contract copy, the framework, react, react-i18next and swr', () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
    for (const path of sourceFiles) {
      const file = relative(appSource, path);
      for (const specifier of importsOf(readFileSync(path, 'utf8'))) {
        const target = join(dirname(path), specifier);
        const ownFile = specifier.startsWith('.') && !relative(join(appSource, '..'), target).startsWith('..');
        expect({ file, specifier, allowed: ownFile || allowedPackages.includes(specifier) }).toEqual({
          file,
          specifier,
          allowed: true,
        });
      }
    }
  });

  it('keeps its copy of the contract folder exactly as the omnibar had it', () => {
    const hash = createHash('sha256');
    for (const path of filesUnder(ownContract).sort()) {
      hash
        .update(relative(ownContract, path).split(sep).join('/'))
        .update('\0')
        .update(readFileSync(path))
        .update('\0');
    }
    expect(hash.digest('hex')).toBe(contractCopySha256);
  });

  const providers = sourceFiles.filter((file) => /\.provider\.tsx?$/.test(file));

  // The workspace2 store isn't a framework export. The host reads it and passes context.workspaceGroup.
  it('has providers that never read or subscribe to the private workspace2 store', () => {
    expect(providers.length).toBeGreaterThan(0);
    for (const path of providers) {
      const source = readFileSync(path, 'utf8');
      expect({
        file: relative(appSource, path),
        subscribes:
          /\buseStore\b|\bgetState\b|\bgetWorkspace2Store\b|\bworkspaceGroupNameOf\b|\bworkspaceGroupIsOpen\b/.test(
            source,
          ),
      }).toEqual({ file: relative(appSource, path), subscribes: false });
    }
  });

  // The host decides the patient and passes context.patientUuid; the address bar can be ahead of it.
  it('has providers that never read the URL to find the patient', () => {
    expect(providers.length).toBeGreaterThan(0);
    for (const path of providers) {
      const source = readFileSync(path, 'utf8');
      expect({
        file: relative(appSource, path),
        readsUrl: /\blocation\b|\buseParams\b|\bchartPatientIdOf\b|\bchart-path\b/.test(source),
      }).toEqual({ file: relative(appSource, path), readsUrl: false });
    }
  });
});
