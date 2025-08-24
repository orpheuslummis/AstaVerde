// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

interface IAstaVerde {
    function vaultSendTokens(uint256[] calldata ids) external;
    function vaultRecallTokens(uint256[] calldata ids) external;
    function setApprovalForAll(address operator, bool approved) external;
}

contract MaliciousVaultReceiver is IERC1155Receiver {
    IAstaVerde public immutable astaVerde;
    uint256 public reentrancyAttempts;
    bool public shouldReenter;
    uint256[] public tokenIdsToReenter;

    constructor(address _astaVerde) {
        astaVerde = IAstaVerde(_astaVerde);
    }

    function setShouldReenter(bool _should) external {
        shouldReenter = _should;
    }

    function setTokenIdsToReenter(uint256[] calldata _ids) external {
        tokenIdsToReenter = _ids;
    }

    function approveAstaVerde(address operator) external {
        astaVerde.setApprovalForAll(operator, true);
    }

    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external override returns (bytes4) {
        if (shouldReenter && tokenIdsToReenter.length > 0) {
            reentrancyAttempts++;
            shouldReenter = false; // Prevent infinite loop

            // Try to reenter vaultSendTokens
            try astaVerde.vaultSendTokens(tokenIdsToReenter) {
                // If successful, this would be a vulnerability
            } catch {
                // Expected to fail due to nonReentrant
            }

            // Try to reenter vaultRecallTokens
            try astaVerde.vaultRecallTokens(tokenIdsToReenter) {
                // If successful, this would be a vulnerability
            } catch {
                // Expected to fail due to nonReentrant
            }
        }

        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external override returns (bytes4) {
        if (shouldReenter && tokenIdsToReenter.length > 0) {
            reentrancyAttempts++;
            shouldReenter = false; // Prevent infinite loop

            // Try to reenter vaultSendTokens
            try astaVerde.vaultSendTokens(tokenIdsToReenter) {
                // If successful, this would be a vulnerability
            } catch {
                // Expected to fail due to nonReentrant
            }

            // Try to reenter vaultRecallTokens
            try astaVerde.vaultRecallTokens(tokenIdsToReenter) {
                // If successful, this would be a vulnerability
            } catch {
                // Expected to fail due to nonReentrant
            }
        }

        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId;
    }
}
