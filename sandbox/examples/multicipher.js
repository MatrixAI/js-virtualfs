import Cryptor from '../../lib/Cryptor.js';
import {default as fs} from 'fs';
import kbpgp from 'kbpgp';




// key to encrypt secret key
var allyPub1 = './sandbox/keys/ally1_pub.asc';
var allyPub1Key = fs.readFileSync(allyPub1);

var allyPub2 = './sandbox/keys/ally2_pub.asc';
var allyPub2Key = fs.readFileSync(allyPub2);

// secret key
var pubPath = './sandbox/keys/efs_pub.asc';
var privPath = './sandbox/keys/efs_priv.asc';
var passphrase = 'efs';

var cryptor = new Cryptor(pubPath, privPath, passphrase);


cryptor.addAllyKey(allyPub1Key, (keys) => {
	console.log('adding ally key, key is: ');
	console.log(allyPub1Key.toString());
});

cryptor.addAllyKey(allyPub2Key, (keys) => {
	console.log('adding ally key, key is: ');
	console.log(allyPub2Key.toString());
});

cryptor._encryptSecretKey( (secretKey) => {
	console.log('encrypting secret key with all ally keys');
	console.log(secretKey);


	var allyPriv1 = './sandbox/keys/ally1_priv.asc';
	var allyPriv2 = './sandbox/keys/ally2_priv.asc';
	var allyPriv1Key = fs.readFileSync(allyPriv1);
	var allyPriv2Key = fs.readFileSync(allyPriv2);

	var params = {
		armored: allyPriv1Key

	}
	kbpgp.KeyManager.import_from_armored_pgp(params, (err, keyMgr) => {
		if (err) throw err;
		keyMgr.unlock_pgp({passphrase: 'efs'}, (err) => {
			cryptor.decrypt(secretKey, (err, literals) => {
				console.log('decrypting secret key with first ally key');
				console.log(literals[0].toString());	
			}, keyMgr);
		});
	});

	params = {
		armored: allyPriv2Key

	}
	kbpgp.KeyManager.import_from_armored_pgp(params, (err, keyMgr) => {
		if (err) throw err;
		keyMgr.unlock_pgp({passphrase: 'efs'}, (err) => {
			cryptor.decrypt(secretKey, (err, literals) => {
				console.log('decrypting secret key with second ally key');
				console.log(literals[0].toString());	
			}, keyMgr);
		});
	});
});

