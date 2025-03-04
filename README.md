# Ymap Coords Finder

A Node.js tool designed to scan FiveM resource directories for `.ymap` files, analyze their coordinates using a custom `YmapChecker` executable, and generate a JSON report with geometric medians, maximum Z values, and closest postal codes. This tool is useful for FiveM developers working with custom maps to identify spatial data and integrate it with postal code systems.

## Features

- **Recursive `.ymap` Scanning**: Scans specified directories for `.ymap` files, grouping them by resource.
- **Coordinate Extraction**: Uses a platform-specific `YmapChecker` executable to extract 3D coordinates from `.ymap` files.
- **Geometric Analysis**: Calculates the 2D geometric median and maximum Z value for each `.ymap` and resource-wide.
- **Postal Code Integration**: Identifies the closest postal code from a provided `postals.json` file based on 2D coordinates.
- **Cross-Platform Support**: Automatically detects the operating system (Windows, Linux, macOS) and uses the appropriate `YmapChecker` executable.
- **JSON Output**: Generates a detailed `ymap_analysis.json` file with results for further use.

## Prerequisites

- **Node.js**: Version 14.x or higher (tested with Node.js 18.x).
- **FiveM Server**: A FiveM server setup with resources containing `.ymap` files.
- **File Structure**: Ensure `data/ymaps.lst` and `data/postals.json` are present in the working directory.

## Installation

1. **Clone the Repository** (if applicable):
   ```bash
   git clone https://github.com/mindkind/ymap-coords-finder.git
   cd ymap-coords-finder
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```
   This installs the required Node.js modules (fs.promises, path, child_process are built-in, so no additional packages are needed).

3. **Prepare Executables**:
   Place the platform-specific YmapChecker executables in the bin directory:
   - `bin/win-x64/YmapChecker.exe` (Windows 64-bit)
   - `bin/linux-x64/YmapChecker` (Linux 64-bit)
   - `bin/osx-x64/YmapChecker` (macOS 64-bit)
   
   Ensure executable permissions on Linux/macOS:
   ```bash
   chmod +x bin/linux-x64/YmapChecker
   chmod +x bin/osx-x64/YmapChecker
   ```

   **Note:** The `YmapChecker` executable used in this script comes from [mindkind/YmapChecker](https://github.com/mindkind/YmapChecker).

4. **Prepare Data Files**:
   - Copy `ymaps.lst` (list of base-game .ymap names) to `data/ymaps.lst`.
   - Copy `postals.json` (postal code coordinates, e.g., `[{"x": ..., "y": ..., "code": ...}, ...]`) to `data/postals.json`.

## Usage

1. **Adjust Directory Paths (if needed)**:
   Edit `scan.js` to update `directoriesToCheck` if your .ymap files are in different locations:
   ```javascript
   const directoriesToCheck = [
     '/path/to/your/resources/[maps]/[maps-paid]',
     '/path/to/your/resources/[maps]/[maps-unpaid]',
   ];
   ```

2. **Run the Script**:
   ```bash
   node scan.js
   ```
   The script will:
   - Load base-game .ymap names and postal codes.
   - Scan the specified directories for .ymap files.
   - Skip base-game .ymap files (matched against ymaps.lst).
   - Process custom .ymap files with YmapChecker.
   - Output analysis to the console and write results to `ymap_analysis.json`.

3. **Example Output**:
   ```
   Loaded 10581 base-game ymap entries from ./data/ymaps.lst.
   Loaded 1687 postal codes from ./data/postals.json.

   === Resource Group: "mickystudio_lady_dallas" ===
       Path: /home/fivem/FXServer/server-data/afterlifev3/txData/CFXDefault_928DAD.base/resources/[maps]/[maps-paid]/[maps-paid-clubs]/[micky]/mickystudio_lady_dallas
       Found 16 .ymap file(s).
       Detected .fxap => Resource is likely escrow-encrypted.
       Found resource script: fxmanifest.lua
       Skipping 'cs1_far_occl_00.ymap' (exact match with base-game ymap)
       ...
       Processing individual ymap: mickystudio_lady_dallas_exterieur.ymap
       -> Running ./bin/linux-x64/YmapChecker on: /path/to/mickystudio_lady_dallas_exterieur.ymap
           Objects found in 'mickystudio_lady_dallas_exterieur.ymap': 284
           2D Median -> X=-698.231, Y=5799.516
           MaxZ = 37.846
           Center coordinate -> X=-698.231, Y=5799.516, Z=37.846
           Closest postal code: 1079
       ...
       Results written to ./ymap_analysis.json
       All resources processed.
   ```

## Troubleshooting

- **Error: Unsupported Platform:**
  Ensure you're running on Windows, Linux, or macOS. Other OSes (e.g., FreeBSD) are not supported yet.
- **YmapChecker Fails:**
  Verify the executable paths in `bin/` match your setup. Check permissions (Linux/macOS) or compatibility (Windows).
- **Missing Data Files:**
  Ensure `data/ymaps.lst` and `data/postals.json` exist and are correctly formatted.
- **No Coordinates Found:**
  Confirm YmapChecker outputs in the expected format (Object: X=..., Y=..., Z=...).

## Contributing

Feel free to fork this repository, submit pull requests, or open issues for bugs/features. Contributions to improve platform support, performance, or documentation are welcome!

## License

This project is unlicensed (public domain). Use it freely, but please credit the original author if you redistribute or modify it.
