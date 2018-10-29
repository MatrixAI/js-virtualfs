import kbpgp from 'kbpgp';
import {default as fs} from 'fs';


// TODO: ASP for progress monitoring
class Cryptor {
	_publicKey: str;
	_privateKey: str;
	// TODO: better way to store passphrase? prompt user?
	_passphrase: str;
	_keyMgr: kbpgp.KeyManager;
	constructor(
		// TODO: Will there always be public key sharing? Can there be passphrase (symetric)
		publicKeyPath,	
		// TODO: any changes required to use subkeys instead?
		privateKeyPath,
		privPassphrase
	) : void {
		// TODO: keypair and passphrase may not be needed if usig keyMgr
		this._publicKey = fs.readFileSync(publicKeyPath);
		this._privateKey = fs.readFileSync(privateKeyPath);
		this._passphrase = privPassphrase;
		
		var self = this;

		// TODO: javascript logging?
		// intialise key manager inst for supplied key pair
		kbpgp.KeyManager.import_from_armored_pgp({
			armored: self._publicKey
			}, function(err, efsKeyMgr) {
				if (!err) {
					efsKeyMgr.merge_pgp_private({
						armored: self._privateKey
					}, function(err) {
						if (!err) {
							if (efsKeyMgr.is_pgp_locked()) {
								efsKeyMgr.unlock_pgp({
									passphrase: self._passphrase
								}, function(err) {
									if (!err) {
										console.log("Loaded private key with passphrase");
									}
								});
							} else {
								console.log("Loaded private key w/o passphrase");
							}
						}
					});
				}
			self._keyMgr = efsKeyMgr;
		});
	}

	// TODO: get optional sign with argument
	encrypt(recipientKeyMgr, plaintext, callback) {
		var params = {
			msg: plaintext,
			encrypt_for: recipientKeyMgr  
		};	

		
		kbpgp.box(params, (err, cipherText, cipherBuffer) => {
			callback(err, cipherText, cipherBuffer);
		});

	};

	// TODO: encryptBuffer 
	// ASSUME: CHECK: Keynode always knows the correct decryption key ahead of time? i.e. it's own
	decrypt(keyMgr, cipherText, callback) {
		var params = {
			keyfetch: keyMgr, 
			armored: cipherText
		}

		kbpgp.unbox(params, (err, literals) => {
			if (err) throw err;
			callback(err, literals);
		});
	}

	


}


//var pubPath = './lib/efs_pub.asc';
//var privPath = './lib/efs_priv.asc';
//var passphrase = 'efs';
//
//var cryptor = new Cryptor(pubPath, privPath, passphrase);
//
//var cipher = cryptor.encrypt(cryptor._keyMgr, "Hello, World!", (err, cipherText, cipherBuffer) => {
//	if (err) throw err;
//
//	cryptor.decrypt(cryptor._keyMgr, cipherText, (err, literals) => {
//		if (err) throw err;
//		console.log(literals[0].toString());
//	});
//});
//
//
//console.log(cipher);
export default Cryptor;
//cryptor.decrypt(cryptor._keyMgr, )
//var pubkey = fs.readFileSync('./lib/efs_pub.asc', 'utf-8');
//var privkey = fs.readFileSync('./lib/efs_priv.asc', 'utf-8');
//var passphrase = 'efs';
//
//kbpgp.KeyManager.import_from_armored_pgp({
//  armored: pubkey
//}, function(err, efsKeyMgr) {
//  console.log('loading pub key');
//  if (!err) {
//      console.log('success');
//      efsKeyMgr.merge_pgp_private({
//      armored: privkey
//    }, function(err) {
//	    console.log('lading priv key' + err);
//      if (!err) {
//	      console.log('success');
//        if (efsKeyMgr.is_pgp_locked()) {
//          efsKeyMgr.unlock_pgp({
//            passphrase: passphrase
//          }, function(err) {
//            if (!err) {
//              console.log("Loaded private key with passphrase");
//            }
//          });
//        } else {
//          console.log("Loaded private key w/o passphrase");
//        }
//      }
//    });
//  }
//});
//
//var params = {
//  msg:         "This is EFS to EFS, do we have an encrypted file system yet?",
//  encrypt_for: chuck,
//  sign_with:   alice
//};
//
//kbpgp.box (params, function(err, result_string, result_buffer) {
//  console.log(err, result_string, result_buffer);
//});
