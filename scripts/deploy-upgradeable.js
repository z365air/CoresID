const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const baseURI = process.env.BASE_URI || "https://coresid.vercel.app/metadata/";

  const CoresID = await ethers.getContractFactory("CoresID");

  const proxy = await upgrades.deployProxy(CoresID, [baseURI, deployer.address], {
    kind: "uups",
    initializer: "initialize",
  });

  await proxy.waitForDeployment();

  const proxyAddress = await proxy.getAddress();
  console.log("Proxy deployed to:", proxyAddress);

  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("Implementation deployed to:", implAddress);

  console.log("Verify with:");
  console.log(`npx hardhat verify --network base ${implAddress}`);

  return proxyAddress;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
