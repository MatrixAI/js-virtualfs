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
	_cryptor: Cryptor;
	_ivLength: integer;
	// _keyManger -- contains and manages all the key for this secret bundle
	constructor(
		upperDir = new VirtualFS, 
		lowerDir = fs,	// TODO: how create new instance of fs class? 
		ivLength = 16
	) : void {
		this._cryptor = new Cryptor();
		this._upperDir = upperDir;
		this._lowerDir = lowerDir;
		this._ivLength = ivLength
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
		return new Promise ( (resolve, reject) => {
			var cipherText;
			this._cryptor.genRandomIV().then( (iv) => {
				// file should start with iv
				cipherText = iv;
				return this._cryptor.encrypt(data);
			}).then((ct) => {
				// concat with encrypted file data
				cipherText += ct;

				// persist on disk 
				fs.writeFile(filename, cipherText, (err) => {
					if (err) 
						reject(err);
					resolve();
				});
			});
		});
	}

	// TODO: impl other params
	open(path) {
		return new Promise((resolve, reject) => {
			fs.open(path, 'r', (err, fd) => {
				if (err) {
					reject(err);
				}
				resolve(fd);
			});
		});
	}

	read(fd, buffer: Buffer, offset, length, position) {
		return new Promise((resolve, reject) => {
			var iv = new Buffer(this._ivLength);
			fs.read(fd, iv, 0, this._ivLength, 0, (err, bytesRead, buffer) => {
				if (err)
					reject(err)
				else if (bytesRead < this._ivLength) 
					reject('Could not read all of initialisation vector');

				fs.read(fd, buffer, offset, length, position, (err, bytesRead, buffer) => {
					if (err)
						reject(err);
					this._cryptor.decrypt()
					resolve(bytesRead, buffer);
				});
			});
		});
	}
}

var efs = new EncryptedFS;
efs.readdir('./');
// TODO: find a way to remove init(). Incorp into constrcutor
efs._cryptor.init('password').then( () => {
	return efs.writeFile('testing.txt', 'something very readable')
}).then( () => {
	efs.readdir('./');
	return efs.open('testing.txt');
}).then((fd) => {
	var dummybuf;
	return efs.read(fd, dummybuf, 0, 10, 0);
}).then(() => {

});



