var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/', async function(req, res, next) {
  const { FileSystemWallet, Gateway, X509WalletMixin } = require('fabric-network');
  const path = require('path');
  
  const ccpPath = path.resolve(__dirname, '..', 'config', 'connection-org1.json');
  
      try {
          // Create a new file system based wallet for managing identities.
          const walletPath = path.join(process.cwd(), 'wallet');
          const wallet = new FileSystemWallet(walletPath);
          console.log(`Wallet path: ${walletPath}`);
  
          // Check to see if we've already enrolled the user.
          const name = req.query.name;
          const userExists = await wallet.exists(name);

          if (!userExists) {
            // Check to see if we've already enrolled the admin user.
            const adminExists = await wallet.exists('admin');
            if (!adminExists) {
                console.log('An identity for the admin user "admin" does not exist in the wallet');
                console.log('Run the enrollAdmin.js application before retrying');
                return;
            }

            // Create a new gateway for connecting to our peer node.
            const gateway_admin = new Gateway();
            await gateway_admin.connect(ccpPath, { wallet, identity: 'admin', discovery: { enabled: true, asLocalhost: true } });

            // Get the CA client object from the gateway for interacting with the CA.
            const ca = gateway_admin.getClient().getCertificateAuthority();
            const adminIdentity = gateway_admin.getCurrentIdentity();

            // Register the user, enroll the user, and import the new identity into the wallet.
            // const secret = await ca.register({ affiliation: 'org1.department1', enrollmentID: name, role: 'client' }, adminIdentity);
            const secret = await ca.register(
              { affiliation: "org1.department1", enrollmentID: name, role: "client", attrs:[{name:'role',value:'client',ecert: true}] },
              adminIdentity
            );
            const enrollment = await ca.enroll({ enrollmentID: name, enrollmentSecret: secret });
            const userIdentity = X509WalletMixin.createIdentity('Org1MSP', enrollment.certificate, enrollment.key.toBytes());
            await wallet.import(name, userIdentity);
          }
  
          // Create a new gateway for connecting to our peer node.
          const gateway = new Gateway();
          // use the identity of user1 from wallet to connect
          await gateway.connect(ccpPath, { wallet, identity: name, discovery: { enabled: true, asLocalhost: true } });
  
          // Get the network (channel) our contract is deployed to.
          const network = await gateway.getNetwork('mychannel');
  
          // Get the contract from the network.
          const contract = network.getContract('record_dev');

          // Evaluate the specified transaction.
          // queryCar transaction - requires 1 argument, ex: ('queryCar', 'CAR4')
          // queryAllCars transaction - requires no arguments, ex: ('queryAllCars')
          const result = await contract.submitTransaction('createPatientRecord');
          console.log(`Transaction has been evaluated, result is: ${result.toString()}`);

          res.json(JSON.parse(result));
  
      } catch (error) {
          console.error(`Failed to evaluate transaction: ${error}`);
          // process.exit(1);
      }
      
});


router.get('/info', async function(req, res, next) {
  const { FileSystemWallet, Gateway, X509WalletMixin } = require('fabric-network');
  const path = require('path');
  const ccpPath = path.resolve(__dirname, '..', 'config', 'connection-org1.json');
  
  try {
    const name = req.query.name;

    const walletPath = path.join(process.cwd(), 'wallet');
    const wallet = new FileSystemWallet(walletPath);
    console.log(`Wallet path: ${walletPath}`);

    // Check to see if we've already enrolled the user.
    const userExists = await wallet.exists(name);

    if (!userExists) {
      console.log(`An identity for the user ${name} does not exist in the wallet`);
      return;
    }

    const gateway = new Gateway();
    await gateway.connect(ccpPath, { wallet, identity: name, discovery: { enabled: true, asLocalhost: true } });
    const network = await gateway.getNetwork('mychannel');
    const contract = network.getContract('record_dev');

    const result = await contract.submitTransaction('getMyMedicalInfo');

    res.json(JSON.parse(result.toString()));
  } catch (error) {
    console.error(`Failed to evaluate transaction: ${error}`);
    // process.exit(1);
  }
  
})

module.exports = router;
