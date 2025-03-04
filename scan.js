const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

// Directories to check (your custom .ymap folders)
const directoriesToCheck = [
  '../[maps]/',
];
const baseGameIdentifiersPath = './data/ymaps.lst';
const postalCodesPath = './data/postals.json';
const outputJsonPath = './ymap_analysis.json';
let baseGameYmaps = new Set();
let postalCodes = [];

// Determine the appropriate YmapChecker executable based on the OS
const getYmapCheckerExecutable = () => {
  const platform = process.platform;
  switch (platform) {
    case 'win32':
      return path.join(__dirname, 'bin', 'win-x64', 'YmapChecker.exe'); // Absolute path
    case 'linux':
      return path.join(__dirname, 'bin', 'linux-x64', 'YmapChecker');   // Absolute path
    case 'darwin':
      return path.join(__dirname, 'bin', 'osx-x64', 'YmapChecker');     // Absolute path
    default:
      throw new Error(`Unsupported platform: ${platform}. Supported platforms are win32, linux, and darwin.`);
  }
};

// Load base-game ymap identifiers from file
const loadBaseGameYmapNames = async () => {
  try {
    const data = await fs.readFile(baseGameIdentifiersPath, 'utf-8');
    baseGameYmaps = new Set(data.split(/\r?\n/).map(l => l.trim()).filter(Boolean));
    console.log(`Loaded ${baseGameYmaps.size} base-game ymap entries from ${baseGameIdentifiersPath}.`);
  } catch (err) {
    console.error(`Error loading base-game ymap names from ${baseGameIdentifiersPath}:`, err.message);
  }
};

// Load postal codes from file
const loadPostalCodes = async () => {
  try {
    const data = await fs.readFile(postalCodesPath, 'utf-8');
    postalCodes = JSON.parse(data);
    console.log(`Loaded ${postalCodes.length} postal codes from ${postalCodesPath}.`);
  } catch (err) {
    console.error(`Error loading postal codes from ${postalCodesPath}:`, err.message);
  }
};

// Check if a given baseName is a base-game ymap (exact match only)
const isBaseGameYmap = baseName => baseGameYmaps.has(baseName);

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

// Check resource folder for .fxap and for resource script
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
    const executable = getYmapCheckerExecutable();
    console.log(`    -> Running ${executable} on: ${filePath}`);
    const coords = [];
    const child = spawn(executable, [filePath], { shell: true });
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
  coords.length === 0 ? { x: 0, y: 0 } : {
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

// Find the closest postal code to a given coordinate
const findClosestPostalCode = (coord) => {
  if (!postalCodes.length) return "N/A";
  let closest = null;
  let minDistance = Infinity;
  for (const postal of postalCodes) {
    const dist = distance2D(coord, { x: postal.x, y: postal.y });
    if (dist < minDistance) {
      minDistance = dist;
      closest = postal.code;
    }
  }
  return closest;
};

// Process individual ymap file and return its analysis
const processYmapFile = async (filePath, baseName) => {
  const coords = await runYmapChecker(filePath);
  console.log(`        Objects found in '${baseName}.ymap': ${coords.length}`);
  let result = { objectCount: coords.length };
  if (coords.length > 0) {
    const median2D = compute2DGeometricMedian(coords);
    const maxZ = Math.max(...coords.map(c => c.z));
    const finalCoordinate = { x: median2D.x, y: median2D.y, z: maxZ };
    const closestPostalCode = findClosestPostalCode(median2D);
    console.log(`        2D Median -> X=${median2D.x.toFixed(3)}, Y=${median2D.y.toFixed(3)}`);
    console.log(`        MaxZ = ${maxZ.toFixed(3)}`);
    console.log(`        Center coordinate -> X=${finalCoordinate.x.toFixed(3)}, Y=${finalCoordinate.y.toFixed(3)}, Z=${finalCoordinate.z.toFixed(3)}`);
    console.log(`        Closest postal code: ${closestPostalCode}`);
    result = {
      ...result,
      median2D: { x: median2D.x, y: median2D.y },
      maxZ,
      centerCoordinate: finalCoordinate,
      closestPostalCode
    };
  } else {
    console.log(`        No objects found in '${baseName}.ymap'`);
  }
  return { coords, result };
};

// Main processing routine
const processAllResources = async () => {
  try {
    await Promise.all([loadBaseGameYmapNames(), loadPostalCodes()]);
    const ymapFiles = await gatherAllYmapFiles(directoriesToCheck);
    const filesByResourceDir = {};
    for (const filePath of ymapFiles) {
      const resourceKey = getUniqueResourceKey(filePath);
      filesByResourceDir[resourceKey] = filesByResourceDir[resourceKey] || [];
      filesByResourceDir[resourceKey].push(filePath);
    }

    const jsonOutput = {};
    for (const [resourceDir, fileList] of Object.entries(filesByResourceDir)) {
      const folderName = path.basename(resourceDir);
      console.log(`\n=== Resource Group: "${folderName}" ===`);
      console.log(`    Path: ${resourceDir}`);
      console.log(`    Found ${fileList.length} .ymap file(s).`);
      const { escrow, scriptFile } = await checkResourceFiles(resourceDir);
      if (escrow) console.log('    Detected .fxap => Resource is likely escrow-encrypted.');
      if (!scriptFile) console.log('    No __resource.lua or fxmanifest.lua found => the mapping is deactivated.');
      else console.log(`    Found resource script: ${scriptFile}`);

      const resourceData = {
        path: resourceDir,
        ymapCount: fileList.length,
        hasEscrow: escrow,
        scriptFile,
        ymaps: {
          baseGame: [],
          custom: {}
        },
        totalObjects: 0,
      };
      
      let allCoords = [];
      for (const filePath of fileList) {
        const baseName = path.basename(filePath, '.ymap');
        if (isBaseGameYmap(baseName)) {
          console.log(`    Skipping '${baseName}.ymap' (exact match with base-game ymap)`);
          resourceData.ymaps.baseGame.push(baseName);
          continue;
        }
        console.log(`    Processing individual ymap: ${baseName}.ymap`);
        const { coords, result } = await processYmapFile(filePath, baseName);
        resourceData.ymaps.custom[baseName] = result;
        allCoords.push(...coords);
      }
      
      console.log(`    Total custom objects retrieved across all ymaps: ${allCoords.length}`);
      resourceData.totalObjects = allCoords.length;
      if (allCoords.length > 0) {
        const median2D = compute2DGeometricMedian(allCoords);
        const maxZ = Math.max(...allCoords.map(c => c.z));
        const finalCoordinate = { x: median2D.x, y: median2D.y, z: maxZ };
        const closestPostalCode = findClosestPostalCode(median2D);
        console.log(`    Resource-wide analysis:`);
        console.log(`        2D Median -> X=${median2D.x.toFixed(3)}, Y=${median2D.y.toFixed(3)}`);
        console.log(`        MaxZ = ${maxZ.toFixed(3)}`);
        console.log(`        Final center coordinate -> X=${finalCoordinate.x.toFixed(3)}, Y=${finalCoordinate.y.toFixed(3)}, Z=${finalCoordinate.z.toFixed(3)}`);
        console.log(`        Closest postal code: ${closestPostalCode}`);
        resourceData.resourceWide = {
          median2D: { x: median2D.x, y: median2D.y },
          maxZ,
          centerCoordinate: finalCoordinate,
          closestPostalCode
        };
      } else {
        console.log('    No custom coords to analyze in this resource folder.');
      }
      jsonOutput[folderName] = resourceData;
    }

    // Write results to JSON file (overwrites existing file)
    await fs.writeFile(outputJsonPath, JSON.stringify(jsonOutput, null, 2), 'utf-8');
    console.log(`\nResults written to ${outputJsonPath}`);
    console.log('All resources processed.');
  } catch (error) {
    console.error('Error:', error);
  }
};

processAllResources();