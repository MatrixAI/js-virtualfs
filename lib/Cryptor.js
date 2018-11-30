import {default as fs} from 'fs';
import crypto from 'crypto';

// TODO: Cryptor is highly coupled to kbpgp, consider applying inversion of control, e.g Cryptor ABC/interface and have KBPGP_Cryptor strategy

class Cryptor {

	constructor(
	) : void {
	}

	init(password) {
		return new Promise( (resolve)  => {
			this._iv = this.genRandomIV();
			this._iv.then((initVec) => {
				this._iv = initVec;
				return this.pbkdf(password);
			}).then((key) => {
				this._key = key;
				return this._genCipher(this._key, this._iv);
			}).then((cipher) => {
				this._cipher = cipher;
				return this._genDecipher(this._key, this._iv);
			}).then((decipher) => {
				this._decipher = decipher;
				resolve();
			});
		});
	}

	_updateState(iv: number) {
		this._iv = iv;
		console.log('entered update state');
		return new Promise((resolve, reject) => {
			_genCipher(this._key, this._iv).then((cipher) => {
				this._cipher = cipher;
				return _genDecipher(this.Key, this._iv);
			}).then((decipher) => {
				this._decipher = decipher;
				resolve();
			});
		});

	}

	pbkdf(pass, salt='', algo='sha256', keyLen=32, numIterations=10000) {
		return new Promise( (resolve, reject) => {
			crypto.pbkdf2(pass, salt, numIterations, keyLen, algo, (err, key) => {
				if (err) {
					reject(err);
				} else {
					resolve(key);
				}
			});
		});
	} 

	// TODO: should we be returning a promise on something that is sync?
	_genCipher(key, iv, algo='id-aes256-GCM') {
		return new Promise( (resolve, reject) => {
			var symCipher = crypto.createCipheriv(algo, key, iv);

			resolve(symCipher);
		});
	}

	async encrypt(plaintext, iv=null) {
		if (iv) 
			await _updateState(iv);
		return new Promise( (resolve, reject) => {
			console.log(this._cipher.update(plaintext));
			resolve(
				this._cipher.update(plaintext)
			);
		});
	}

	// stage and commit useful for streaming data
	encryptStage(plaintext) {
		return new Promise( (resolve, reject) => {
			resolve(
				this._cipher.update(plaintext)
			);
		});
	}

	encryptCommit() {
		return new Promise( (resolve, reject) => {
			resolve(
				this._cipher.final()
			)
		});
	}

	_genDecipher(key, iv, algo='id-aes256-GCM') {
		return new Promise( (resolve, reject) => {
			var symDecipher = crypto.createDecipheriv(algo, key, iv);

			resolve(symDecipher);
		});
	}

	async decrypt(plaintext, iv=null) {
		if (iv) 
			await _updateState(iv);
		return new Promise( (resolve, reject) => {
			resolve(
				this._decipher.update(plaintext)
			);
		});
	}

	// stage and commit useful for streaming data
	decryptStage(plaintext) {
		return new Promise( (resolve, reject) => {
			resolve(
				this._decipher.update(plaintext)
			);
		});
	}

	decryptCommit() {
		return new Promise( (resolve, reject) => {
			resolve(
				this._decipher.final()
			);
		});
	}

	genRandomIV() {
		return new Promise((resolve, reject) => {
			// TODO: magic number
			var iv = crypto.randomBytes(16)

			resolve(iv);
		});
	}

}
/*
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
*/



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

