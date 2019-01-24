import EncryptedFS from '../lib/EncryptedFS.js';
import fs from 'fs';
import test from 'ava';

test.beforeEach(async t => {
	t.context.efs = new EncryptedFS;
	await t.context.efs._cryptor.init('secret password');
});


test('constructor type', t => {
	t.true(t.context.efs instanceof EncryptedFS);
});

test('readdir', t => {
	let expected = fs.readdirSync('./');
	let actual = t.context.efs.readdirSync('./')
	t.deepEqual(actual, expected);
});


