const {LEAGUES,json,api}=require('./_lib');module.exports=api(async(req,res)=>json(res,200,{leagues:LEAGUES},3600));
