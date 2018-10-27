import kbpgp from 'kbpgp';
import {default as fs} from 'fs';


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
		this._publicKey = fs.readFileSync(publicKeyPath);
		this._privateKey = fs.readFileSync(privateKeyPath);
		this._passphrase = privPassphrase;

		// TODO: javascript logging?
		// intialise key manager inst for supplied key pair
		kbpgp.KeyManager.import_from_armored_pgp({
			armored: this._publicKey
			}, function(err, efsKeyMgr) {
				this._keyMgr = efsKeyMgr;
				if (!err) {
					efsKeyMgr.merge_pgp_private({
						armored: this._privateKey
					}, function(err) {
						if (!err) {
							if (efsKeyMgr.is_pgp_locked()) {
								efsKeyMgr.unlock_pgp({
									passphrase: this._passphrase
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
		});
	}
}


var pubPath = './lib/efs_pub.asc';
var privPath = './lib/efs_priv.asc';
var passphrase = 'efs';

var cryptor = new Cryptor(pubPath, privPath, passphrase);

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
