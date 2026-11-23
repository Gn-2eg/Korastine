'use strict';
const {LEAGUES,dateCairo,allowedDate,json,api}=require('./_lib');
const {fixtures}=require('./_sources');
module.exports=api(async(req,res)=>{
 const date=typeof req.query?.date==='string'?req.query.date:dateCairo();
 if(!allowedDate(date)||![dateCairo(-1),dateCairo(),dateCairo(1)].includes(date))return json(res,400,{error:'اختار أمس أو اليوم أو بكرة فقط'});
 const {matches,errors}=await fixtures(date);
 return json(res,200,{date,matches,leagues:LEAGUES,errors,updatedAt:new Date().toISOString(),note:'التغطية تختلف حسب المصدر والخطة؛ النتائج قد تتأخر'},120);
});
