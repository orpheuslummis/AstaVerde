// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;
// Test helper: a borrower contract that tries to re-enter from the collateral-return callback.
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
interface IVault { function depositBatch(uint256[] calldata) external; function withdraw(uint256) external; function deposit(uint256) external; }
contract ReentrantBorrower {
    IERC1155 public immutable av; IVault public immutable vault; IERC20 public immutable scc;
    bool public armed; uint256 public reenterId; address public sink;
    bool public reenterWithdrawOk; bytes public reenterWithdrawErr;
    bool public forwardOk; bytes public forwardErr;
    bool public reenterDepositOk; bytes public reenterDepositErr;
    constructor(address _av, address _vault, address _scc) { av = IERC1155(_av); vault = IVault(_vault); scc = IERC20(_scc); }
    function setup() external { av.setApprovalForAll(address(vault), true); scc.approve(address(vault), type(uint256).max); }
    function depositBatch(uint256[] calldata ids) external { vault.depositBatch(ids); }
    function arm(uint256 id, address _sink) external { armed = true; reenterId = id; sink = _sink; }
    function withdraw(uint256 id) external { vault.withdraw(id); }
    function onERC1155Received(address, address from, uint256 id, uint256, bytes calldata) external returns (bytes4) {
        if (armed && from == address(vault)) {
            armed = false;
            try vault.withdraw(reenterId) { reenterWithdrawOk = true; } catch (bytes memory e) { reenterWithdrawErr = e; }
            try vault.deposit(id) { reenterDepositOk = true; } catch (bytes memory e) { reenterDepositErr = e; }
            try av.safeTransferFrom(address(this), sink, id, 1, "") { forwardOk = true; } catch (bytes memory e) { forwardErr = e; }
        }
        return this.onERC1155Received.selector;
    }
    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata) external pure returns (bytes4) { return this.onERC1155BatchReceived.selector; }
    function supportsInterface(bytes4 i) external pure returns (bool) { return i == 0x4e2312e0 || i == 0x01ffc9a7; }
}
