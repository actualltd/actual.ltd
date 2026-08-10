import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const source = await readFile(path.join(root, "src/main.ts"), "utf8");
const styles = await readFile(path.join(root, "src/styles.css"), "utf8");

const movementMatch = source.match(/backgroundX\.set\(x\s*\*\s*(-?[\d.]+)\)/);
const overscanMatch = styles.match(/--background-overscan:\s*([\d.]+)rem/);
const frameMatch = styles.match(/\.background-parallax\{([^}]*)\}/);

if (!movementMatch) throw new Error("Unable to determine the background parallax range.");
if (!frameMatch) throw new Error("Unable to find the background parallax frame.");

const maximumHorizontalTravel = Math.abs(Number(movementMatch[1])) / 2;
const overscanPixels = overscanMatch ? Number(overscanMatch[1]) * 16 : 0;
const frame = frameMatch[1];

if (overscanPixels < maximumHorizontalTravel + 2) {
  throw new Error(`Background overscan is ${overscanPixels}px but parallax can travel ${maximumHorizontalTravel}px.`);
}

if (!frame.includes("inset:calc(var(--background-overscan) * -1)") || !frame.includes("width:auto") || !frame.includes("height:auto")) {
  throw new Error("The moving background frame itself must be oversized; scaling only its image cannot prevent edge gaps.");
}

console.log(`Background frame overscans its ${maximumHorizontalTravel}px parallax travel without exposing the page.`);
