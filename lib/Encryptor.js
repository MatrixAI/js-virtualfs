//@flow
/** @module Encryptor */

import openpgp, {key, message} from 'openpgp';
import {default as fs} from 'fs';

console.log(openpgp);
console.log(key);
console.log(message);

openpgp.initWorker({ path:'openpgp.worker.js' });

var pubkey = fs.readFileSync('./lib/efs_pub.asc', 'utf-8');
var privkey = fs.readFileSync('./lib/efs_priv.asc', 'utf-8');
var passphrase = 'efs';

// put keys in backtick (``) to avoid errors caused by spaces or tabs
//const pubkey = `-----BEGIN PGP PUBLIC KEY BLOCK-----
//
//mQENBFvS/McBCADW7g3Yis0e10hI+YiAfrlFIm+h8ViUsq59k9M7DBAp1b6EKPcF
//hCRuwsLmww9QpGV/T8h+iu3CWXFMOoEJZhxO4mJ9tXL64lYWHdHdqkJqS2CnMVuN
//5iUMSH3aalmCjTQ1mOw+3aIVunbeYwQd6xqIE29DJTryj7KGw8oSaSV2qaZo5Go/
//vgCJG/MnccSwjbqTNXutOA/CtG7U7ygiU9M9e4H+y8027gErF6aaXgCx00YiTQEI
//wbuJ+J3afBgCATAAmKHF5bdHEBvHnVcb1uO9oji4pIJaWiWq/vYaT73XBDsqfHi3
//Sd9TJO3Nt62GFnHFt0BLgtprvfdCt5FQZNxFABEBAAG0U0Fhc2h3aW4gVmFyc2hu
//ZXkgKEtleSB1c2VkIGZvciB0ZXN0aW5nIHdpdGggZW5jcnlwdGZzKSA8YWFzaHdp
//bi52YXJzaG5leUBtYXRyaXguYWk+iQFOBBMBCAA4FiEEVh2Qjwad7PcDhHk20+vP
//APVvsnQFAlvS/McCGwMFCwkIBwIGFQoJCAsCBBYCAwECHgECF4AACgkQ0+vPAPVv
//snT3cAf/QmCNvtyQRY/AaFhaUbUjPIhKTbMOOogJPwqLCOrFXjzWqF2rLQ4tYaT5
//ORuUWzHbVBssMx1D371DzVrD3z5w54GWTWIotCb5Oqm2Qy4j/P7EZ4PswLYnrRxv
//GsQ6wqCBvCnLeGm1aNSqpq/ASxrdOsEJIz3fCkNsvg5XDtyX4FJrRknlIm7vADFf
//85mzmFzkudVfK6GhV8/1jkzxDi64Y0YanWcdqoEQ+FsgpNjNwXpx2YzBzgzWMzH+
//FigAIgkhR7jdX5hbbCmEjHZAjz9GQWE9CClHll5KB4SpHOPUTWhu4mEuDajLz8Fz
//600AWsBwkX0Z28tWLNN57knMRy15dQ==
//=pkrp
//-----END PGP PUBLIC KEY BLOCK-----`;
//const pubkey = fs.readFileSync('./lib/efs_pub.key', 'utf-8');
//
//const privkey = `-----BEGIN PGP PRIVATE KEY BLOCK-----
//
//lQPGBFvT9esBCADHkKU3ME2fYx72z9bpZHOE7BePSM4OtSom/eZHyDWNMbY0CZL1
//PP1kDaP3EAkG1cUpxIiHUyxs1A0r0UsH+R1bd6fzgIRt/OeL45T/J2RrHxpv6/E6
//9f/ichy+6HIoXyKDYMRNny2gIiOWret5ZRwGq3QrwOiQtCAIyImh3absZP+yN7o5
//hiLl8hzoQMlQrXoMCMcZxIhArIe0DcuN5qeS0M6eMxx1VQ5Tu8twnM6AsRONGQ+W
//tXZ2QMsnAncZjWOi2O+cZTzUpMhf7wogTVvHM0s4c8N9HzyZGhaVGOHqDPBDCxku
//qxqzN7p3QsMpEufmiIYa40LdxDGi5a6MHwXZABEBAAH+BwMCAVFoNd7CXY/vZgYO
//iGPk92376qy73ZKoO3RuqBj6jJ9wKger8YwT+xNfiESz8AcePyOSAjZReceVQ/HF
//VlZUm0bGQbkFsPRMKjrQMQDYtAQ9NflT/0QL6eVJ9SjXTybC4NENhdnVvPLlmG1A
//mmnB4DP6mCy2JkqNZke2a8gPSL/BrUsAmOYSmaL2BSBGLNvNm/RpKa8bIZe7zRtn
//Kw3VH5dcHyfnJ3ZtJF0RcVumNVy7jnU2a+AOTBzwcmCnY8PHOA2FM3gU8KTKQ3QG
//F5Jelf4u1zUdm4S+cP9vST7ttGk1HmrWPWS1SpTBz/loEobc8UaU/7jemVIVOB+A
//OqZNF+8LleqzWhZZoD0kKK7Efc//pBVjwpy8/DS7VhBu3ZxLb+o15uwxSNY3+LcH
//4TH/ZWeqOnbuveihgNtOyfcWkSjjS2mbF+F0V5+V9GDJy77Dcn1sv3sYX9HfvOcj
//mVMqWa2UDidDhyHijWDL/0j+FWDzI179NbFPszyvVBwYuQUtyGOJENiVPFzz6c73
//AX69PFm+AWg1E+oEOfi0JzsMmkQIfhRRKlnelYXmYnF1JKuvr9OsnHiODYoHHp8f
//buGN0u0NZ8zO6e7rQOrSkgcijLEW25AO/sA9FtUJR+2yQvRTCxVOsB9ltOqY2g+A
//KwklSBV4kzy+AfpOcbEFFLDFlDuqjvGgFAJ5GHDifk2d2NNN9RW19RwuBDUDshW8
//NK9yZgtzwFxmzwM/22pWQK3fa8MXWuXwC78tqjLTdUeRBtIzlZrjWTHZOrJBpScC
//iQkIZuz4iFhNILVENw9fAEnhqaMmi2B7PN6pZeS8AYF2V7s8BCzEzQicaipNl27s
//1DiZQgmpQHhNAWRzsfvF2YtySVnprKbbeTK3dfhrxNZYhf8mTAiYo08ziO5qRsFb
//d4Sshcu9fwT0tENBYXNod2luIFZhcnNobmV5IChLZXkgZm9yIGVmcyB0ZXN0aW5n
//KSA8YWFzaHdpbi52YXJzaG5leUBtYXRyaXguYWk+iQFUBBMBCAA+FiEEjiIV7SpC
//PQnaOGSe3tDruiL6wGIFAlvT9esCGwMFCQHhM4AFCwkIBwIGFQoJCAsCBBYCAwEC
//HgECF4AACgkQ3tDruiL6wGLU5wf/QMXY2DUFonir9j/O89I+gYEzssDo2XkGYgkC
//5PUx9Ak7RQC6MXiV13DyUTolq+VD1T/4UvNnv9vYZaerYVKU+5p8ohegkqCrWwP+
//9GSFFKoMovQdw9GhOF84WS1oY32+X85bq+wBeTUFiJcpHUwmZrcL1OQrk4nKGsS6
//I8tlfpwwXN8KbfHRYZpwF1dITTEiaHAvAV9EK9d1CjhZGTu5lW5hW8gPJSiXKjZ6
//TZwlwxf7cUbdWZ3v/GI5Mja09NIe6ceJ4lLk+MB2ZiYyXiJlkuc7SBp0I73qkvm0
//QRELsizkcwwYQ/w/Q4uEbPZVFWeaHmZaK1LUruIDLPtd9SNh550DxgRb0/XrAQgA
//pYYBMgdDKnm1rT5jT2jECX5XN9ovr/S99bRHST/UeMIaLz0ls1710i4DC00k42Qa
//8QFnARVRmTsODAG9OVxS8bby0MY/kbKYC3INXlYEyAsvQ6Ja598gXg26Q4vhc4A/
//4KGOs+QnnQbPXmibXHX6bJSBSIh7be0gJmmtb60zSDduTyzySoszDZKHPJqJd+kM
//oJBS8nQOL7NtIAKmrv76+st05D30BG9k08zoosKmStKrQP+Xhvk7HNtbrPeTij/U
//H5zloQTyC62thxIo8r2bE+5xmymFg4c1zWyIyOgKgKPvg7kSW3hjhJhUwBYdUo4r
//EqHiwThKvkPy47M721O8iwARAQAB/gcDArugSp+qcjA+7yMfpnMLJXp/TYd2fJZ7
//6HozoDvVlysJWinmQ6QHeTod+D9S3bsR4OTi1lQa5vWAyeSGWD7CC543jhbgY5zT
//uTrqVbwE91GJDDPneJf8c2B7Po6X7kNKwrrshlPzP82GhBWVBFBYOJtm2YeWsWTn
//hIV3SsID/BzxytnqaXidgN/2oPXHHVWPunQCC/6tR3vY9E2lA/mzmT+rs/Ry3aSE
//Xj80KlBvHT6zIA+ES4TSZF/dNJijC+aEYcE5Tdcz0v4cj/dDoDcAtCu4o84uXCa7
//ePpxATvG/+tsAzMUvaC+Dap+mv7W33sQ7cc9GpLSRjWSZPskyw3NXc1s9/e+FHyN
//pPuCBYUxKRmBD4AYGUjnRHM7azkHlpEQaanxRU72jhsvkF9p5X+sY0pmmgUmtXnz
//iBFMc+pr8hZfYldz5FZlOFAlsPUjjLdrV/gzNtPgBRDf6jK7JOAMjGg3JCzTeg5b
//DycjxyLTOuP9N9XnlbNrkpOTlqljv6mqhxh/Tno7OH8V8tD/LIBlCeQ7n9BJm2ug
//5yUFN4p6pfj4KZMEW6MbGoaEu8UrlAv8ZQbJ9jh8jE2mHeGXrBPI0x14zl+rVpy5
//llF9mrqPnmUsaIp5cVnczG7TUAp5k6LctLtJBHXYmswZ9EJtjSPfauOCzr/CY5s8
//l//3DOcS5Z8pKpKpoGUOVBMc0Wvz16V5UmXKRymYqxT1zoZPYZTugFsBW86HnRsf
//rRxAgtUFzyNppSEP+JksDlD40/Ha2dwt16Oc6PWe0STRBP2XS8PFsqWTCMeA1LSU
//SITb5HAj+JPrFoKs44XXJJ7wDXYmZYhEtbNOVZgYxv6dF2jChBN/rSzeW5QGQiru
//icDDeQKGOLw9B51vZqAGb9d5uj0dMnSW5U6JXAfN7Gl4G1XR2V1j+ip+0ybzJokB
//PAQYAQgAJhYhBI4iFe0qQj0J2jhknt7Q67oi+sBiBQJb0/XrAhsMBQkB4TOAAAoJ
//EN7Q67oi+sBiFU8H/12SpQoYbbyjS4Ipu4NvzB2plvLFNdKOO1WlRCHbnMZT0NmK
//hjXjOqyMqB60nA6dS87ZFmMjpnRRlavuCLQ1Lu1x63tq7G+lusFstaxF2g6E2+At
//uvvG15E5gCdKGHQg5GLkkuS6u5DMT4q9hGsG/+Jr1cyD29nHExy3ilECOhTXfkQS
//7k3dFTWkn5jXOPTiel5R1jNLJ6RT3TxQoapC6TxFQs3iUoJdT32DyUxVDIoP9Txs
//VkqSM8t8sH8PQg5TLfswpyQBH2M2ml4Q0LJHVtye+gurVOT6uN3w2bBIWtZlR7mB
//CJByELR3zqtYnO1UNS5XPfeUfGizvLUw2AO8NqA=
//=0sIG
//-----END PGP PRIVATE KEY BLOCK-----`;



const encryptDecryptFunction = async() => {
    const privKeyObj = (await key.readArmored(privkey)).keys[0];
    await privKeyObj.decrypt(passphrase);

    const options = {
        message: message.fromText('Hello, World!'),       // input as Message object
        publicKeys: (await key.readArmored(pubkey)).keys, // for encryption
        privateKeys: [privKeyObj]                                 // for signing (optional)
    };

   //console.dir(options.publicKeys, {depth: null});

    openpgp.encrypt(options).then(ciphertext => {
	console.log(ciphertext.data);
        encrypted = ciphertext.data; // '-----BEGIN PGP MESSAGE ... END PGP MESSAGE-----'

        return encrypted;
	
    })
    .then(async (encrypted) => {
        const options = {
            message: await message.readArmored(encrypted),    // parse armored message
            publicKeys: (await key.readArmored(pubkey)).keys, // for verification (optional)
            privateKeys: [privKeyObj]                                 // for decryption
        };

        openpgp.decrypt(options).then(plaintext => {
            console.log(plaintext.data);
            return plaintext.data; // 'Hello, World!'
        });

    });
}

encryptDecryptFunction();
