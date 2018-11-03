import kbpgp from 'kbpgp';
import {default as fs} from 'fs';

// TODO: Cryptor is highly coupled to kbpgp, consider applying inversion of control, e.g Cryptor ABC/interface and have KBPGP_Cryptor strategy

// TODO: ASP for progress monitoring
class Cryptor {
	_secretKey: str;
	_publicKey: str;
	_privateKey: str;
	// TODO: better way to store passphrase? prompt user?
	_passphrase: str;
	_keyMgr: kbpgp.KeyManager;
	_allyKeyRing: kbpgp.keyring.KeyRing;
	constructor(
		// TODO: Will there always be public key sharing? Can there be passphrase (symetric)
		publicKeyPath,	
		// TODO: any changes required to use subkeys instead?
		privateKeyPath,
		privPassphrase
	) : void {
		// TODO: keypair and passphrase may not be needed if usig keyMgr
		// TODO: constructor should be taking in already read keys in memory
		this._publicKey = fs.readFileSync(publicKeyPath);
		// TODO:  is this safe to have this in memory?
		this._privateKey = fs.readFileSync(privateKeyPath);
		// TODO: what is the point of public key encryption for the secret key? We can use symmetric (AES), it'd be more performant
		this._passphrase = privPassphrase;
		// TODO:Cryptor shouldn't be responsible for managing keys, breaks SRP.
		this._allyKeyRing = new kbpgp.keyring.KeyRing();
		// TODO: can you get the array of key form the keyring?
		this._allyKeys = [];
		this._secretKey = null;
		
		var self = this;
		
		// SUPER TODO: generate symmetric vault key and with node public key

		// TODO: javascript logging?
		// TODO: can we make this constructor cleaner?
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
			self._allyKeyRing.add_key_manager(efsKeyMgr);
			self._allyKeys.push(efsKeyMgr);
		});
	}

	// TODO: get optional sign with argument
	encrypt(recipientKeyMgr, plaintext, callback) {
		var params = {
			msg: plaintext,
			encrypt_for: recipientKeyMgr  
		};	

		
		kbpgp.box(params, (err, cipherText, cipherBuffer) => {
			if (err) throw err;
			callback(err, cipherText, cipherBuffer);
		});

	};

	// TODO: encryptBuffer 
	// ASSUME: CHECK: Keynode always knows the correct decryption key ahead of time? i.e. it's own
	decrypt(cipherText, callback, keyfetch = this._allyKeyRing) {
		var params = {
			keyfetch: keyfetch, 
			armored: cipherText
		}

		kbpgp.unbox(params, (err, literals) => {
			if (err) {console.log(err); throw err;}
			callback(err, literals);
		});
	}

	
	addAllyKey(key: str, callback) {
		var params = {
			armored: key
		};
		
		kbpgp.KeyManager.import_from_armored_pgp(params, (err, keyMgr) => {
			if (err) throw err;
			this._allyKeyRing.add_key_manager(keyMgr);
			this._allyKeys.push(keyMgr);
			callback(this._allyKeys);
		});

		// TODO: rmeove here for debugging
	}


	_encryptSecretKey(callback) {
		var params = {
			// TODO: this should eventually be some symettric key
			msg: this._publicKey,
			encrypt_for: this._allyKeys
		};	

		kbpgp.box(params, (err, cipherText, cipherBuffer) => {
			if (err) throw err;
			this._secretKey = cipherText;
			// TODO: remove debugging
			callback(this._secretKey);
		});
	}


}




//var cipher = cryptor.encrypt(cryptor._keyMgr, "Hello, World!", (err, cipherText, cipherBuffer) => {
//	if (err) throw err;
//
//	console.log(cipherText);
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
//cryptor.decrypt(cryptor._keyMgr, 
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
