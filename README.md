# IS4302 Group 4 Pawnshop

---

## Setup Instructions

### 1. Install Dependencies

In your project root folder, run the following command to install all necessary dependencies:

```bash
npm i
```

This will install the following:

- Hardhat: A development environment for Ethereum.
- Husky: To run Git hooks.
- lint-staged: To run Prettier on staged files before committing.
- Prettier: To automatically format your code.

### 2. Set up Husky

Run the following command to set up Husky (for Git hooks like `pre-commit`):

```bash
npm run prepare
```

This will install Husky's hooks.

---

## Development Setup

### 1. Start Hardhat Node

Run a local Hardhat network by running:

```bash
npx hardhat node
```

This will start an in-memory Ethereum node, where contracts will be deployed.

### 2. Deploy the Contract

Deploy the `Pawnshop.sol` contract to your local Hardhat network with: (Remember to edit the deploy.js if you add more contracts)

```bash
npm run wire:local
```

This will:

- Deploy the contract to the local Hardhat node.
- Update your frontend with the correct contract address and ABI.
- Ensure the `.env` file is updated with the correct contract address.

---

## Frontend Setup

### 1. Start Frontend Development Server

To start the frontend, run:

```bash
cd frontend
npm run dev
```

This will start the development server for your frontend at `http://localhost:5173`.

---

## Running Tests

You can run tests with Hardhat using the following commands:

### 1. Run All Tests

```bash
npx hardhat test
```

---

## Git Hooks

### 1. Automatic Code Formatting with Prettier

The project uses Husky and lint-staged to run Prettier before every commit. This ensures that code is always properly formatted.

- Prettier will automatically format any staged files (`*.js`, `*.jsx`, `*.ts`, `*.tsx`, etc.) before committing.

### 2. Running Prettier Manually

If you need to run Prettier manually on all files, run:

```bash
npx prettier --write .
```

---
