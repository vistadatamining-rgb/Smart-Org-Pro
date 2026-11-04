const {p256}=require('@noble/curves/p256'); const {sha256}=require('@noble/hashes/sha256');
const b64u=b=>Buffer.from(b).toString('base64url');
// test keypair replaces the project's public key
const priv=p256.utils.randomPrivateKey(); const pub=p256.getPublicKey(priv,false);
const jwk={kty:'EC',crv:'P-256',x:b64u(pub.slice(1,33)),y:b64u(pub.slice(33,65))};
require('fs').writeFileSync(__dirname+'/License/publicKey.js','"use strict";Object.defineProperty(exports,"__esModule",{value:true});exports.LICENSE_PUBLIC_KEY_JWK='+JSON.stringify(jwk)+';');
global.window={location:{hostname:'x',href:'x'}}; global.localStorage={_d:{},getItem(k){return this._d[k]??null},setItem(k,v){this._d[k]=v}};
const {evaluateLicense}=require('./License/LicenseEngine');
const ctx=()=>({host:{},dataView:undefined});
function mk(o){const payload={product:'smartOrgPro',tier:'pro',period:'monthly',issuedAt:new Date(Date.now()-86400000).toISOString(),expiresAt:new Date(Date.now()+30*86400000).toISOString(),...o};
 const bytes=Buffer.from(JSON.stringify(payload)); const sig=p256.sign(sha256(bytes),priv).toCompactRawBytes(); return b64u(bytes)+'.'+b64u(sig);}
let fail=0; async function t(name,key,email,dev,exp,valid){const r=await evaluateLicense(ctx(),key,email,dev); const ok=r.reason===exp&&r.valid===valid; if(!ok)fail++; console.log(ok?'PASS':'FAIL',name,'->',r.reason,r.valid);}
(async()=>{
await t('no key = free','', '', 'D','no_license',false);
await t('valid any tier','' + mk({}),'','D','ok',true);
await t('tier premium+daily (no pairing rule)',mk({tier:'premium',period:'daily'}),'','D','ok',true);
await t('no tier field',mk({tier:undefined}),'','D','ok',true);
await t('unlimited',mk({period:'unlimited',expiresAt:null}),'','D','ok',true);
await t('prefix SOP1.','SOP1.'+mk({}),'','D','ok',true);
await t('whitespace/newline paste',' '+mk({}).replace(/(.{40})/g,'$1\n')+' ','','D','ok',true);
await t('expired',mk({expiresAt:new Date(Date.now()-1000).toISOString()}),'','D','expired',false);
await t('wrong product',mk({product:'other'}),'','D','wrong_product',false);
await t('device mismatch',mk({deviceCode:'AAAA'}),'','D','device_mismatch',false);
await t('device ok',mk({deviceCode:'D'}),'','D','ok',true);
await t('email required',mk({boundEmail:'a@b.com'}),'','D','no_email',false);
await t('email mismatch',mk({boundEmail:'a@b.com'}),'x@y.com','D','email_mismatch',false);
await t('email case-insens',mk({boundEmail:'A@B.com'}),' a@b.COM ','D','ok',true);
await t('issued in future',mk({issuedAt:new Date(Date.now()+5*86400000).toISOString()}),'','D','clock_rollback_detected',false);
const k=mk({}); const bad=k.slice(0,-3)+(k.slice(-3)==='AAA'?'BBB':'AAA');
await t('tampered signature',bad,'','D','invalid_key',false);
const [pl,sg]=mk({}).split('.'); const forged=Buffer.from(JSON.stringify({product:'smartOrgPro',period:'unlimited',expiresAt:null,issuedAt:new Date().toISOString()})).toString('base64url')+'.'+sg;
await t('forged payload',forged,'','D','invalid_key',false);
await t('garbage','hello','','D','invalid_key',false);
console.log(fail?fail+' FAILED':'ALL PASSED'); process.exit(fail?1:0);})();
