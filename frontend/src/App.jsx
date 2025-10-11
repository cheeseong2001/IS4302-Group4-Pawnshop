// This is just a simple template
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import pawnshopArtifact from "./abi/Pawnshop.json";

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
const RPC_URL = "http://127.0.0.1:8545"; // local Hardhat node

export default function App() {
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [status, setStatus] = useState("");
  const [dummyResult, setDummyResult] = useState(null);

  useEffect(() => {
    const setup = async () => {
      try {
        const localProvider = new ethers.providers.JsonRpcProvider(RPC_URL);
        setProvider(localProvider);

        const c = new ethers.Contract(
          CONTRACT_ADDRESS,
          pawnshopArtifact.abi,
          localProvider,
        );
        setContract(c);

        const network = await localProvider.getNetwork();
        setStatus(`Connected to Hardhat node (chainId: ${network.chainId})`);
      } catch (err) {
        console.error(err);
        setStatus("Failed to connect to local Hardhat node");
      }
    };

    setup();
  }, []);

  async function callDummy() {
    if (!contract) {
      setStatus("Contract not ready yet");
      return;
    }
    console.log(contract.dummy());
    try {
      const result = await contract.dummy();
      setDummyResult(result.toString());
      setStatus("Called dummy() successfully");
    } catch (err) {
      console.error(err);
      setStatus("Error calling dummy()");
    }
  }

  return (
    <div
      style={{ maxWidth: 640, margin: "2rem auto", fontFamily: "system-ui" }}
    >
      <h1>Pawnshop DApp (Local)</h1>
      <p>
        <b>RPC URL:</b> {RPC_URL}
      </p>
      <p>
        <b>Contract:</b> {CONTRACT_ADDRESS}
      </p>

      <button
        onClick={callDummy}
        style={{ padding: "0.5rem 1rem", marginTop: "1rem" }}
      >
        Call dummy()
      </button>

      <div style={{ marginTop: "1rem" }}>
        <p>
          <b>dummy() result:</b> {dummyResult ?? "—"}
        </p>
        <p>
          <b>Status:</b> {status}
        </p>
      </div>
    </div>
  );
}
