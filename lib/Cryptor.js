import fs from 'fs';
import crypto from 'crypto';
import process from 'process';

// TODO: flow types
// TODO: funciton docs

export default class Cryptor {
	constructor(pass, iv=this._genRandomIVSync(), algo='id-aes256-GCM') : void {
		this._algo = algo;
		this._iv = iv;
		// TODO: generate salt ? 
		this._key = this._pbkdfSync(pass);
		this._cipher = crypto.createCipheriv(algo, this._key, this._iv);
		this._decipher = crypto.createDecipheriv(algo, this._key, this._iv);
	}


	encryptSync(plainBuf) {
		return this._cipher.update(plainBuf);
	}

	encrypt(plainBuf, cb) {
		this._callAsync(
			this.encryptSync.bind(this),
			[plainBuf],
			cb
		);
		return;
	}

	decryptSync(cipherBuf) {
		return this._decipher.update(cipherBuf);
	}

	decrypt(cipherBuf, cb) {
		this._callAsync(
			this.decryptSync.bind(this),
			[cipherBuf],
			cb
		);
		return;
	}
	//encyrpt ()
	// nextrick(encryptrSync
	// if ^^ fails set err else set jults and do callback(err, result)

	// TODO: should all of these be public methods?
	// ========= HELPER FUNCTIONS =============
	_callAsync(syncFn, args, cb) {
		process.nextTick(() => {
			let result = null;
			let err = null;
			try {
				result = syncFn(...args);
			} catch (e) {
				err = err;	
			}
			cb(err, result);
		});
	}	

	_pbkdfSync(pass, salt='', algo='sha256', keyLen=32, numIterations=10000) {
		return crypto.pbkdf2Sync(pass, salt, numIterations, keyLen, algo);
	}

	_pbkdf(pass, salt='', algo='sha256', keyLen=32, numIterations=10000, callback) {
		let err = null;
		crypto.pbkdf2(pass, salt, numIterations, keyLen, algo, (err, key) => {
			callback(err, key);
		});
	}

	// TODO: should there be an input param for variable length iv?
	_genRandomIVSync() {
		return crypto.randomBytes(16);
	}
}

