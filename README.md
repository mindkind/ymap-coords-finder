# GTA V Ymap Tools Suite

This repository contains a set of tools to scan and process `.ymap` files in GTA V mapping resources. The tools help:
- **Detect and extract coordinates** from `.ymap` files.
- **Filter out base-game `.ymap` files** using a predefined list (`dataIdentifiers.txt`).
- **Identify escrow-encrypted resources** and check if mappings are active.
- **Compute the safest teleport location** based on mapping data.

## Features
- **Recursive Scanning:** Scans directories for `.ymap` files.
- **Base-Game Filtering:** Skips `.ymap` files matching `dataIdentifiers.txt`.
- **Escrow & Activation Detection:** Checks if resources contain `.fxap` (escrow) or activation files (`fxmanifest.lua` or `__resource.lua`).
- **Coordinate Extraction:** Uses `YmapChecker` to pull object locations from `.ymap` files.
- **Geometric Median Calculation:** Determines the best **X, Y position** using coordinate clustering.
- **Safe Z Height Selection:** Uses the highest object Z value to prevent underground placement.
- **Customizable Filters:** Supports partial or exact matches for base-game filtering.

## Requirements
- [Node.js](https://nodejs.org/) (v10+ recommended)
- `YmapChecker` (from [MindKind/YmapChecker](https://github.com/mindkind/YmapChecker))
- `dataIdentifiers.txt` (list of base-game `.ymap` files to ignore)

## Installation
1. **Clone the Repository:**
   ```bash
   git clone https://github.com/mindkind/ymap-coords-finder.git
   cd ymap-coords-finder
   ```
2. **Ensure Node.js is installed:**
   ```bash
   node -v
   ```
3. **Make `YmapChecker` executable (if needed):**
   ```bash
   chmod +x ./YmapChecker
   ```
4. **Prepare `dataIdentifiers.txt`:**
   ```
   lr_cs6_
   cs1_02_builds
   hei_
   ```

## Usage

### **Run the scan using Node.js:**
```bash
node scan.js
```
- This script will scan the directories, process `.ymap` files, and output results.

## File Structure

### **1. `YmapChecker` (External Tool)**
- **Source:** [MindKind/YmapChecker](https://github.com/mindkind/YmapChecker)
- **Purpose:** Extracts object coordinates from `.ymap` files.

### **2. `scan.js` (Main Scanner)**
- Scans directories for `.ymap` files.
- Filters out base-game maps using `dataIdentifiers.txt`.
- Runs `YmapChecker` to extract coordinates.
- Detects `.fxap` files (escrow protection).
- Checks for `fxmanifest.lua` or `__resource.lua` (resource activation).
- Computes **final teleport coordinates** based on extracted mapping data.

### **3. `ymaps.js` (API Data Fetcher)**
- Fetches base-game `.ymap` identifiers from `https://api.plebmasters.de/v1/ymaps/search`.
- Saves results to `dataIdentifiers.txt`.

### **4. `dataIdentifiers.txt` (Base-Game `.ymap` List)**
- Contains known base-game `.ymap` files to be excluded.

## Example Output from `scan.js`

```
Loaded 3 base-game ymap entries from dataIdentifiers.txt

=== Resource Group: "HG_HarmonyV2" ===
    Path: /absolute/path/to/resources/[maps]/[maps-paid]/HG_HarmonyV2
    Found 5 .ymap file(s).
    Detected .fxap => Resource is likely escrow-encrypted.
    Found resource script: fxmanifest.lua
    Skipping 'lr_cs6_03_critical_0.ymap' (starts with base-game prefix)
    Total custom objects retrieved: 40
    2D Median -> X=1185.733, Y=2664.041
    MaxZ = 36.999
    Final center coordinate -> X=1185.733, Y=2664.041, Z=36.999

All resources processed.
```

### **How This Output is Generated**
1. **`Loaded 3 base-game ymap entries from dataIdentifiers.txt`**  
   - `scan.js` reads `dataIdentifiers.txt` to exclude known GTA V `.ymap` files.

2. **Processing a resource directory:**
   - The script identifies the resource `"HG_HarmonyV2"` from the directory structure.
   - It detects that the **resource is escrow-encrypted** by checking for `.fxap`.
   - It verifies the **resource is active** by finding `fxmanifest.lua`.

3. **Filtering Base-Game `.ymap` Files**
   - `"lr_cs6_03_critical_0.ymap"` is skipped because it **matches an entry in `dataIdentifiers.txt`**.

4. **Extracting Custom Objects**
   - It runs `YmapChecker` on **remaining custom `.ymap` files**.
   - Retrieves **40 objects** from the `.ymap` files.

5. **Computing the Center Coordinate**
   - **Uses the 2D geometric median (ignoring Z)** to compute the most representative X, Y position.
   - **Sets the Z value as the maximum Z** from retrieved coordinates to avoid placing the player underground.

6. **Final Output**
   ```
   Final center coordinate -> X=1185.733, Y=2664.041, Z=36.999
   ```
   - This is the **safe teleport location** derived from the `.ymap` files.

## Contributing
Pull requests are welcome!

## License
MIT License

## Disclaimer
For use with **custom** GTA V mapping resources only.
