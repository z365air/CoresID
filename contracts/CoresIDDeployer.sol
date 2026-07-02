// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import "./coresid.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract CoresIDDeployer {
    CoresID public implementation;
    ERC1967Proxy public proxy;

    constructor(string memory baseURI_, address initialOwner) {
        implementation = new CoresID();

        bytes memory initData = abi.encodeWithSelector(
            CoresID.initialize.selector,
            baseURI_,
            initialOwner
        );

        proxy = new ERC1967Proxy(address(implementation), initData);
    }
}
