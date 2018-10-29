//@flow
/** @module EncryptedFS */

// TODO: offer async varriations of api methods
import {default as fs} from 'fs';
import VirtualFS from './VirtualFS.js';
import Cryptor from './Cryptor.js';

// TODO: key manager class. Each bundle will have a set of keys that are allowed to
// decrypt the bundle
// TODO: make the secret bundle key manager moudle a dependency of cryfs

class EncryptedFS {
	_upperDir : VirtualFS;
	_lowerDir; // TODO: how to make type for fs?
	_cryptor: Cryptor
	// _keyManger -- contains and manages all the key for this secret bundle
	constructor(
		upperDir = new VirtualFS, 
		lowerDir = fs	// TODO: how create new instance of fs class? 
	) : void {
		let pubPath = './lib/efs_pub.asc';
		let privPath = './lib/efs_priv.asc';
		let passphrase = 'efs';

		this._cryptor = new Cryptor(pubPath, privPath, passphrase);
		


		this._upperDir = upperDir;
	}

	// TODO: need the 'fucntion' keyword?
	// TODO: how to represent list type for flow
	readdir(path: string) {
		fs.readdir(path, (err, files) => {
			if (err) {
				console.log(err);
			} else {
				console.log(files);
			}
		});
	}

	// TODO: optional args
	writeFile(filename, data, callback) {
		// no need to do anything with upper dir.
		// write straight to lower
		// TODO: [en|de]crypt() should take keymgg -- is that introducing too much coupling?
		this._cryptor.encrypt()
	}

	

	
}

var efs = new EncryptedFS;
efs.readdir('./');


