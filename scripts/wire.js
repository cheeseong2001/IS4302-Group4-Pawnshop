const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const CONTRACT = process.env.CONTRACT || "Pawnshop";
const NETWORK = process.env.NETWORK || "localhost";
const FRONTEND_DIR = process.env.FRONTEND_DIR || path.join(".", "frontend");

function sh(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "inherit"] }).toString();
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function main() {
  console.log(`=== 0) Compile ${CONTRACT} ===`);
  try {
    sh(`npx hardhat compile`);
  } catch (e) {
    console.error("Compile failed:", e.message);
    process.exit(1);
  }

  console.log(`=== 1) Deploying ${CONTRACT} to ${NETWORK} ===`);
  const out = sh(`npx hardhat run ./scripts/deploy.js --network ${NETWORK}`);
  process.stdout.write(out);

  let m = out.match(/ADDRESS:(0x[a-fA-F0-9]{40})/);
  let addr = m ? m[1] : null;

  // Fallback
  if (!addr) {
    m = out.match(/Contract address:\s*(0x[a-fA-F0-9]{40})/);
    addr = m ? m[1] : null;
  }

  if (!addr) {
    const all = [...out.matchAll(/0x[a-fA-F0-9]{40}/g)].map((x) => x[0]);
    addr = all.length ? all[all.length - 1] : null;
  }

  if (!addr) {
    console.error("Could not parse deployed address from deploy output.");
    process.exit(1);
  }
  console.log(`✓ Deployed address detected: ${addr}`);

  console.log("=== 2) Copy ABI to frontend ===");
  const abiSrc = path.join(
    "artifacts",
    "contracts",
    `${CONTRACT}.sol`,
    `${CONTRACT}.json`,
  );
  const abiDstDir = path.join(FRONTEND_DIR, "src", "abi");
  const abiDst = path.join(abiDstDir, `${CONTRACT}.json`);

  if (!fs.existsSync(abiSrc)) {
    console.error(`ABI not found: ${abiSrc}. Did compile succeed?`);
    process.exit(1);
  }

  ensureDir(abiDstDir);
  fs.copyFileSync(abiSrc, abiDst);
  console.log(`✓ ABI copied to ${abiDst}`);

  console.log("=== 3) Update frontend .env with VITE_CONTRACT_ADDRESS ===");
  const envPath = path.join(FRONTEND_DIR, ".env");
  fs.writeFileSync(envPath, `VITE_CONTRACT_ADDRESS=${addr}\r\n`);
  console.log(`✓ .env updated: ${envPath}`);

  console.log(`=== Done. Frontend is wired to ${addr} ===`);
}

main();
