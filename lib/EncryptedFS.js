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
	// TODO: need to have per file cryptor instance
	_upperDir : VirtualFS;
	_lowerDir; // TODO: how to make type for fs?
	_cryptor: Cryptor;
	_ivSize: integer;
	_blockSize: integer;
	constructor(
		upperDir = new VirtualFS, 
		lowerDir = fs,	// TODO: how create new instance of fs class? 
		ivSize = 128,
		blockSize=4096
	) : void {
		this._cryptor = new Cryptor();
		this._upperDir = upperDir;
		this._lowerDir = lowerDir;
		this._ivSize = ivSize;
		this._blockSize = blockSize;
	}

	// TODO: need the 'fucntion' keyword?
	// TODO: how to represent list type for flow
	readdir(path: string) {
		fs.readdir(path, (err, files) => {
			if (err) {
			} else {
			}
		});
	}

	// TODO: optional args
	writeFile(filename, data, callback) {
		return new Promise ( (resolve, reject) => {
			this._cryptor.genRandomIV().then( (iv) => {
				// file should start with iv
				console.log('writeFile(): iv generate ' + iv.toString('hex'));
				return this._cryptor.encrypt(data, iv);
			}).then((ct) => {
				// TODO: breaking encapsulation here
				let iv = this._cryptor._iv;
				// concat with encrypted file data
				fs.writeFile(filename, Buffer.concat([iv, ct]), (err) => {
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

	// TODO: flow types
	_writeBlock(iv, data)

	// TODO: verify default val for length
	write(fd, buffer, offset=0, length=null, position=0) {
		return new Promise ( (resolve, reject) => {
			var bytesWritten = 0;

			// chunk is comprised of a block and its iv
			var chunkSize = this._blockSize + this._ivSize;

			var chunkNum = Math.floor(position/chunkSize));	
			var chunkOffset = chunkNum * chunkSize;

			// default to size of buffer
			if !(length) 
				length = buffer.length;

			// get file size
			var fileSize = fs.fstatSync(fd)['size'];
			console.log('write(): file size is: ' + fileSize);

			while (bytesWritten < fileSize) {
				var chunkBuff = new Buffer(chunkSize);
				// get amount to write in curr block from buffer
				var blkWriteSize = Math.max((chunkOffset + (chunkSize - 1)) - position, this._blockSize);
				var writeOffset = chunkOffset + bytesWritten;

				var currBlock = new Promise((resolve, reject) => {
				// we are overwriting an existing block
					if (chunkOffset < fileSize) {
						read(fd, blockBuff, 0, this._blockSize, 0).then((block) => {
							// copy the data to write into existing block
							buffer.copy(block, writeOffset, bytesWritten);
							resolve(block);
						});
					} else {
						// writing in a completely new block, return a fresh buffer
						resolve(blockBuff);
					}
				});

				currBlock.then((block) => {
					// generate new iv
					this._cryptor.genRandomIV().then((iv) => {
						// encrypt block
						this._cryptor.encrypt(block, iv).then((ct) => {
							// concat iv and persist
							var persistableBlk = Buffer.concat([iv, ct];
							fs.write(fd, persistableBlk, 0, chunkOffset))			
						});	
					});
				});
							fs.write(fd, Buffer.concat([iv, cryptBlock], 0, this._blockSize, blockOffset, (err, written, buf) => {
								if (err)
									reject(err);
								bytesWritten += written;
							});
			}
			
			var blockData = new Buffer(this._blockSize);
			// read from offset
			// decrypt writeblock
			// while data: writeblock
			this._cryptor.encrypt(buffer, iv).then((ct) => {
				// TODO: breaking encapsulation here
				// concat with encrypted file buffer
				fs.writeFile(filename, Buffer.concat([iv, ct]), (err) => {
					if (err) 
						reject(err);
					resolve();
				});
			});
		});
	}

	read(fd, buffer: Buffer, offset, length, position) {
		return new Promise((resolve, reject) => {
			// get iv size in bytes
			var ivSize = this._ivSize / 8;
			var iv = new Buffer(ivSize);
			// TODO: IV per block stuff
			fs.read(fd, iv, 0, ivSize, 0, (err, bytesRead, ivBuf) => {
				if (err)
					reject(err)
				else if (bytesRead < ivSize) 
					reject('Could not read all of initialisation vector');
				console.log('iv from file: ' + ivBuf.toString('hex'));

				// read ciphertext from file
				fs.read(fd, buffer, offset, length, position+ivSize, (err, bytesRead, buffer) => {
					console.log('read()');
					console.log(buffer);
					if (err)
						reject(err);
					this._cryptor.decrypt(buffer, ivBuf).then((plaintext) => {
						resolve(plaintext.slice(0, bytesRead));
					});
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
	var buf = new Buffer(50);
	return efs.read(fd, buf, 0, 28, 0);
}).then((buf) => {
	console.log('logging final read buffer');
	console.log(buf.toString('hex'));
	console.log(buf.toString('utf8'));
});



