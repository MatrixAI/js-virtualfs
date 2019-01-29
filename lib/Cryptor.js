import fs from 'fs';
import crypto from 'crypto';
import process from 'process';

// TODO: flow type annotations
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


	encryptSync(plainBuf, iv=null) {
		if (iv && (iv !== this._iv)) {
			this._resetEncipher(iv);
		}
		return this._cipher.update(plainBuf);
	}

	// TODO: needs iv param
	encrypt(...args: Array<any>) {
		console.log(this._key.toString('hex'));
		console.log(this._iv.toString('hex'));
		let argSplit = this._separateCallback(args)
		let cb = argSplit.cb;
		let methodArgs = argSplit.args;


		this._callAsync(
			this.encryptSync.bind(this),
			methodArgs,
			cb
		);
		return;
	}

	decryptSync(cipherBuf, iv=null) {
		if (iv && (iv !== this._iv)) {
			this._resetDecipher(iv);
		}

		return this._decipher.update(cipherBuf);
	}

	// TODO: needs iv param
	decrypt(...args: Array<any>) {
		let argSplit = this._separateCallback(args)
		let cb = argSplit.cb;
		let methodArgs = argSplit.args;

		this._callAsync(
			this.decryptSync.bind(this),
			methodArgs,
			cb
		);
		return;
	}

	_resetCipher(iv) {
		this._cipher = crypto.createCipheriv(algo, this._key, iv);

		return;
	}

	_resetDecipher(iv) {
		this._decipher = crypto.createDecipheriv(algo, this._key, iv);

		return;
	}
	//encyrpt ()
	// nextrick(encryptrSync
	// if ^^ fails set err else set jults and do callback(err, result)

	// TODO: should all of these be public methods?
	// ========= HELPER FUNCTIONS =============
	_callAsync(syncFn: Function, args: Array<any>, cb: Function) {
		process.nextTick(() => {
			try {
				let result = syncFn(...args);


				cb(null, result);

			} catch (e) {
				cb(e, null);
			}
		});
	}	

	_separateCallback(args: Array<any>) {
		// it is js convection that the last parameter
		// will be the callback
		
		// pop 'mandatory' callback 
		// TODO: should we be checking that cb is a function?
		let cb = args.pop();

		return {
			cb: cb,
			args: args
		};

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

