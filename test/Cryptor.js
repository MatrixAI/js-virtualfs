import Cryptor from '../lib/Cryptor.js';
import test from 'ava';
import crypto from 'crypto';

const iv = crypto.randomBytes(16);
// TODO: better way to share data b/w test?
var ciphertext;
// test init behavior
test('Cryptor - initialisation', t => {
	let cry = new Cryptor;
	cry.init('secret password');
	return cry.init('secret password').then( result => {
		t.true(cry instanceof Cryptor);
		t.true(cry.isInitialised());
	});
});

test('Cryptor - not initialisation', t => {
	let cry = new Cryptor;

	t.true(cry instanceof Cryptor);
	t.false(cry.isInitialised());
});


// TODO: using serial to share data to decrypts seems like a bad idea.
test.serial('Cryptor - encrypt', async t => {
	let cry = new Cryptor;
	let plaintext = 'very important secret';

	await cry.init('secret password');

	let ct = await cry.encrypt(plaintext);

	t.notDeepEqual(ct, plaintext);
	t.true(ct instanceof Buffer);

	// TODO: set global shared var
	ciphertext = ct;
});


test.serial('Cryptor - decrypt', async t => {
	const expected = Buffer('very important secret');
	let cry = new Cryptor;
	await cry.init('secret password');

	console.log('ciphertext: '  + ciphertext);
	let plaintext = await cry.decrypt(ciphertext, iv);
	console.log(plaintext.toString('utf8'));
	// TODO: literal should be  global var?
	t.deepEqual(expected, plaintext);
	t.pass();
});


// test cipher text
// use deterministic cipher results


// test decrypt
