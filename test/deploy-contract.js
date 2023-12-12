const { generateSmartContractSpecification, EthereumDeployer, EthereumParser, WalletService } = require("../src");
const { OffChainStorage } = require("mco-parser");

const HDWalletProvider = require("@truffle/hdwallet-provider");
const fs = require("fs");

// Create a `.env` file containing these informations:
//IOTA_WASP_MNEMONIC="angle ...... meadow cereal"
//IOTA_EVM_ENDPOINT_URL="http://localhost"
require("dotenv").config();

const phrase = process.env.IOTA_WASP_MNEMONIC;

const providerUrl = process.env.IOTA_EVM_ENDPOINT_URL;

console.log(providerUrl);

const chainId = process.env.IOTA_WASP_CHAIN_ID;

const ipfsGatewayUrl = process.env.IPFS_GATEWAY_URL;

if (process.argv.length < 3) {
    console.error("Please provide contract's MCO representation (.json)");
    process.exit(-1);
}

const mco = JSON.parse(fs.readFileSync(process.argv[2]));

const generate = () => {
    return generateSmartContractSpecification(mco.mediaContractualObjects.contracts[0]);
};

const walletService = new WalletService(process.env.WALLET_SERVICE_URL, process.env.WALLET_SERVICE_TOKEN);

let privateKeys = [];
try {
    const content = fs.readFileSync(process.argv[3]);
    privateKeys = JSON.parse(content);
} catch {
    console.warn("No private keys supplied. Using mnemonic phrase");
}


let provider;

if (privateKeys.length === 0) {
    provider = new HDWalletProvider({
        mnemonic: {
            phrase,
        },
        providerOrUrl: providerUrl,
    });
} else {
    provider = new HDWalletProvider({
        privateKeys,
        providerOrUrl: providerUrl,
    });

    console.log("Using private key file. Addresses: ", provider.getAddresses());
}

const deploy = async (smartContractSpecification, ipfs) => {
    const deployer = new EthereumDeployer(provider, ipfs, chainId);

    deployer.setMediaSC(smartContractSpecification);

    deployer.setWalletService(walletService);

    await deployer.setMainAddressIndex(0);

    await deployer.fetchEvmAccountForParties();

    const res = await deployer.deploySmartContracts();

    const mainAddress = provider.getAddresses()[0];
    // on behalf of the main address the Smart Contract can send tokens
    await deployer.approveToSendTokens(mainAddress, 10000);

    if (false) {
        // sender, destination, amount
        await deployer.payTo(mainAddress, "0xa1d996fCD1ed961F8C1e2cad1af1D00722C73F8E", 1000);
    }

    provider.engine.stop();
    return res.options.address;
};

const parse = async (address, ipfs) => {
    const pars = new EthereumParser(provider, ipfs, address, chainId);
    let res = await pars.parseSmartContract();
    provider.engine.stop();
    return res;
};

const main = async () => {
    const smartContractSpecification = generate();
    const ipfs = new OffChainStorage(ipfsGatewayUrl);
    await ipfs.start();
    let address = await deploy(smartContractSpecification, ipfs);
    res = await parse(address, ipfs);
    await ipfs.stop();
    console.log(res);
};

main();
