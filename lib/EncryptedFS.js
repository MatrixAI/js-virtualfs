//@flow
/** @module EncryptedFS */

// TODO: offer async varriations of api methods
import {default as fs} from 'fs';
import VirtualFS from './VirtualFS.js';

class EncryptedFS {
	_upperDir : VirtualFS;
	_lowerDir; // TODO: how to make type for fs?
	constructor(
		upperDir = new VirtualFS, 
		lowerDir = fs	// TODO: how create new instance of fs class? 
	) : void {
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
}

var efs = new EncryptedFS;
efs.readdir('./');
console.log


