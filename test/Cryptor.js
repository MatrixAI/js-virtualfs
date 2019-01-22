import Cryptor from '../lib/Cryptor.js';
import test from 'ava';
import crypto from 'crypto';


const iv = crypto.randomBytes(16);

test('Cryptor - initialisation', t => {
	let cry = new Cryptor('secret password');
	t.true(cry instanceof Cryptor);
});

test.cb('Cryptor - encrypt async', t => {
	let crySync = new Cryptor('secret password', iv);
	let cry = new Cryptor('secret password', iv);

	let plaintext = 'very important secret';

	let ctSync = crySync.encryptSync(plaintext);
	let ct = cry.encrypt(plaintext, (err, ct) => {
		if (err) {
			t.fail(err)
		} else {
			t.notDeepEqual(ct, plaintext);
			// cipher same as when using sync fn
			t.deepEqual(ct, ctSync);
		}
		t.end();
	});
});

test('Cryptor - encrypt sync', t => {
	let cry = new Cryptor('secret password', iv);
	let cry2 = new Cryptor('secret password', iv);
	let plaintext = 'very important secret';

	let ct = cry.encryptSync(plaintext);
	let ct2 = cry2.encryptSync(plaintext);

	// TODO: we have the iv, passworkd/key, and block mode
	// the ciphertext can be verfied independenty of this
	// we should assert it is equal to the cipher from a diff source
	t.notDeepEqual(ct, plaintext);
	// same cipher when plaintext encrypted with constance iv
	t.deepEqual(ct, ct2);
});

test.cb('Cryptor - decrypt async', t => {
	let cry = new Cryptor('secret password', iv);
	let plaintext = 'very important secret';

	let ct = cry.encryptSync(plaintext);

	cry.decrypt(ct, (err, deciphered) => {
		if (err) {
			t.fail(err)
		} else {
			t.deepEqual(deciphered.toString(), plaintext);
		}
		t.end();
	});
});

test('Cryptor - decrypt sync', t => {
	let cry = new Cryptor('secret password', iv);
	let plaintext = 'very important secret';

	let ct = cry.encryptSync(plaintext);

	let deciphered = cry.decryptSync(ct).toString();

	t.is(deciphered, plaintext);
});

