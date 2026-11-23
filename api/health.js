const {key,api}=require('./_shared');
module.exports=api(async()=>({ok:true,configured:!!key}));
