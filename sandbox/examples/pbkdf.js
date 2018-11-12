import crypto from 'crypto';


//crypto.pbkdf2('secret', 'salt', 100000, 32, 'sha256', (err, derivedKey) => { if (err) throw err;
//	var key = derivedKey.toString('hex');
//	console.log(key);  // '3745e48...08d59ae'
//	// derived key is 256 bits and iv is 128 bits  (block size)
//	var iv = crypto.randomBytes(16);
//	var symCipher = crypto.createCipheriv('aes256', derivedKey, iv);
//	symCipher.update('polykey');
//	var ciphertext = symCipher.final();
//	console.log('ciphertext: ' +  ciphertext.toString('hex'));
//
//	var symDecipher = crypto.createDecipheriv('aes256', derivedKey, iv);
//	//var symDecipher = crypto.createDecipheriv('aes256', derivedKey, '1234567sdfsdfsdfsdfsdf'.slice(0, 16));
//	symDecipher.update(ciphertext);
//	var plaintext = symDecipher.final();
//	console.log('plaintext: ' + plaintext);
//});

function passwordKeyDerivation(pass, salt='', algo='sha256', keyLen=32, numIterations=10000) {
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

function genSymCipher(pass, iv, algo='aes256') {
	return new Promise( (resolve, reject) => {
		var symCipher = crypto.createCipheriv(algo, pass, iv);

		resolve(symCipher);
	});
}

function encryptSymAddText(cipher, plaintext) {
	return new Promise( (resolve, reject) => {
		resolve(
			cipher.update(plaintext)
		);
	});
}

function encryptSymCommitText(cipher) {
	return new Promise( (resolve, reject) => {
		resolve(
			cipher.final()
		)
	});
}

function genSymDecipher(pass, iv, algo='aes256') {
	return new Promise( (resolve, reject) => {
		var symDecipher = crypto.createDecipheriv(algo, pass, iv);

		resolve(symDecipher);
	});
}

function decryptSymAddText(cipher, plaintext) {
	return new Promise( (resolve, reject) => {
		resolve(
			cipher.update(plaintext)
		);
	});
}

function decryptSymCommitText(cipher) {
	return new Promise( (resolve, reject) => {
		resolve(
			cipher.final()
		)
	});
}

var p = passwordKeyDerivation('super secrett');

var iv = crypto.randomBytes(16);
var symPass;
var ciphered;
p.then((key) => {
	symPass = key;
	return genSymCipher(key, iv);
}).then((symCipher) => {
	encryptSymAddText(symCipher, 'polykey');
	return encryptSymCommitText(symCipher);
}).then( (cipherText) => {
	ciphered = cipherText;
	return genSymDecipher(symPass, iv);
}).then ( (symCipher) => {
	console.log(ciphered.toString('hex'));
	decryptSymAddText(symCipher, ciphered);
	return decryptSymCommitText(symCipher);
}).then( (plaintext) => {
	console.log(plaintext.toString());
});

//encryptSymmetric(plaintext, key, callback) {
//
//}
