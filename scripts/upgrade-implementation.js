const { ethers, upgrades } = require("hardhat");

async function main() {
  const PROXY_ADDRESS = "0x165f246dfa92b872fedde1674f0d4c6825215f34";

  const [deployer] = await ethers.getSigners();
  console.log("Upgrader:", deployer.address);

  const CoresID = await ethers.getContractFactory("CoresID");

  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, CoresID, {
    kind: "uups",
  });

  await upgraded.waitForDeployment();

  const implAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("New implementation deployed to:", implAddress);
  console.log("Proxy remains at:", PROXY_ADDRESS);

  console.log("Verify with:");
  console.log(`npx hardhat verify --network base ${implAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
