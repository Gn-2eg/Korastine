const {json,api}=require('./_lib');
module.exports=api(async(req,res)=>json(res,200,{supabaseUrl:process.env.SUPABASE_URL||null,supabaseAnonKey:process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||null}));
