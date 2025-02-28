const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

// Directories to check (your custom .ymap folders)
const directoriesToCheck = [
  '../resources/[maps]/[maps-paid]',
  '../resources/[maps]/[maps-unpaid]',
];
const baseGameIdentifiersPath = './dataIdentifiers.txt';
const partialMatchMode = true;
let baseGameYmaps = new Set();

// Load base-game ymap identifiers from file
const loadBaseGameYmapNames = async () => {
  try {
    const data = await fs.readFile(baseGameIdentifiersPath, 'utf-8');
    baseGameYmaps = new Set(data.split(/\r?\n/).map(l => l.trim()).filter(Boolean));
    console.log(`Loaded ${baseGameYmaps.size} base-game ymap entries from dataIdentifiers.txt`);
  } catch (err) {
    console.warn('Could not read base-game ymap list:', err.message);
  }
};

// Check if a given baseName is considered a base-game ymap
const isBaseGameYmap = baseName => {
  if (!partialMatchMode) return baseGameYmaps.has(baseName);
  for (const prefix of baseGameYmaps) {
    if (baseName.startsWith(prefix)) return true;
  }
  return false;
};

// Recursively gather .ymap files from a directory
const walkDir = async dir => {
  let files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(await walkDir(fullPath));
    else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.ymap')
      files.push(path.resolve(fullPath));
  }
  return files;
};

// Gather .ymap files from multiple directories
const gatherAllYmapFiles = async dirs => {
  let allFiles = [];
  for (const d of dirs) {
    try {
      allFiles = allFiles.concat(await walkDir(d));
    } catch (err) {
      console.warn(`Warning: Could not read directory "${d}":`, err.message);
    }
  }
  return allFiles;
};

// Returns the resource directory (everything up to, but not including, "stream")
const getUniqueResourceKey = filePath => {
  const absPath = path.resolve(filePath);
  const parts = absPath.split(path.sep);
  const idx = parts.indexOf('stream');
  return idx < 1 ? path.join(path.dirname(absPath), 'unknown_resource') : parts.slice(0, idx).join(path.sep);
};

// Check resource folder for .fxap and for resource script (__resource.lua or fxmanifest.lua)
const checkResourceFiles = async dirPath => {
  try {
    const files = await fs.readdir(dirPath);
    const escrow = files.some(f => f.toLowerCase().endsWith('.fxap'));
    const scriptFile = files.includes('__resource.lua')
      ? '__resource.lua'
      : files.includes('fxmanifest.lua')
      ? 'fxmanifest.lua'
      : null;
    return { escrow, scriptFile };
  } catch {
    return { escrow: false, scriptFile: null };
  }
};

// Spawn YmapChecker for a .ymap file and capture coordinates
const runYmapChecker = filePath =>
  new Promise((resolve, reject) => {
    console.log(`    -> Running YmapChecker on: ${filePath}`);
    const coords = [];
    const child = spawn('./YmapChecker', [filePath], { shell: true });
    child.stdout.on('data', data =>
      data
        .toString()
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
        .forEach(line => {
          const m = line.match(/^Object:\s*X=([\d.-]+),\s*Y=([\d.-]+),\s*Z=([\d.-]+)/);
          if (m) coords.push({ x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) });
        })
    );
    child.stderr.on('data', errData => console.error(`    [stderr]: ${errData}`));
    child.on('close', code => (code === 0 ? resolve(coords) : reject(new Error(`YmapChecker exited with code ${code}`))));
  });

// Helper: compute average (X, Y) of coordinates
const averageXY = coords =>
  coords.reduce((acc, c) => ({ x: acc.x + c.x, y: acc.y + c.y }), { x: 0, y: 0 }) && {
    x: coords.reduce((s, c) => s + c.x, 0) / coords.length,
    y: coords.reduce((s, c) => s + c.y, 0) / coords.length,
  };

// Helper: 2D distance
const distance2D = (a, b) => Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));

// Compute 2D geometric median for (X, Y) using Weiszfeld-like iteration
const compute2DGeometricMedian = (coords, maxIter = 100, eps = 1e-7) => {
  if (coords.length === 0) return { x: 0, y: 0 };
  if (coords.length === 1) return { x: coords[0].x, y: coords[0].y };
  let current = averageXY(coords);
  for (let i = 0; i < maxIter; i++) {
    let numX = 0, numY = 0, den = 0;
    for (const p of coords) {
      const d = distance2D(current, p);
      if (d < eps) return { x: p.x, y: p.y };
      const w = 1 / d;
      numX += p.x * w;
      numY += p.y * w;
      den += w;
    }
    const newGuess = { x: numX / den, y: numY / den };
    if (distance2D(current, newGuess) < eps) { current = newGuess; break; }
    current = newGuess;
  }
  return current;
};

// Main processing routine
const processAllResources = async () => {
  try {
    await loadBaseGameYmapNames();
    const ymapFiles = await gatherAllYmapFiles(directoriesToCheck);
    const filesByResourceDir = {};
    for (const filePath of ymapFiles) {
      const resourceKey = getUniqueResourceKey(filePath);
      filesByResourceDir[resourceKey] = filesByResourceDir[resourceKey] || [];
      filesByResourceDir[resourceKey].push(filePath);
    }
    for (const [resourceDir, fileList] of Object.entries(filesByResourceDir)) {
      const folderName = path.basename(resourceDir);
      console.log(`\n=== Resource Group: "${folderName}" ===`);
      console.log(`    Path: ${resourceDir}`);
      console.log(`    Found ${fileList.length} .ymap file(s).`);
      const { escrow, scriptFile } = await checkResourceFiles(resourceDir);
      if (escrow) console.log('    Detected .fxap => Resource is likely escrow-encrypted.');
      if (!scriptFile) console.log('    No __resource.lua or fxmanifest.lua found => the mapping is deactivated.');
      else console.log(`    Found resource script: ${scriptFile}`);
      let allCoords = [];
      for (const filePath of fileList) {
        const baseName = path.basename(filePath, '.ymap');
        if (isBaseGameYmap(baseName)) {
          console.log(`    Skipping '${baseName}.ymap' (${partialMatchMode ? 'starts with base-game prefix' : 'exact match'})`);
          continue;
        }
        const coords = await runYmapChecker(filePath);
        allCoords.push(...coords);
      }
      console.log(`    Total custom objects retrieved: ${allCoords.length}`);
      if (allCoords.length > 0) {
        const median2D = compute2DGeometricMedian(allCoords);
        const maxZ = Math.max(...allCoords.map(c => c.z));
        const finalCoordinate = { x: median2D.x, y: median2D.y, z: maxZ };
        console.log(`    2D Median -> X=${median2D.x.toFixed(3)}, Y=${median2D.y.toFixed(3)}`);
        console.log(`    MaxZ = ${maxZ.toFixed(3)}`);
        console.log(`    Final center coordinate -> X=${finalCoordinate.x.toFixed(3)}, Y=${finalCoordinate.y.toFixed(3)}, Z=${finalCoordinate.z.toFixed(3)}`);
      } else {
        console.log('    No custom coords to analyze in this resource folder.');
      }
    }
    console.log('\nAll resources processed.');
  } catch (error) {
    console.error('Error:', error);
  }
};

processAllResources();
