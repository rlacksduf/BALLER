import {handleBackend} from '../../server/backend.mjs';
export default async function handler(req,res){
 try {return await handleBackend(req,res);}
 catch {res.statusCode=503;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'Database unavailable'}));}
}
