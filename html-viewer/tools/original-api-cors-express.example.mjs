/**
 * EXAMPLE ONLY — adapt inside the ORIGINAL Firebase /api backend.
 * Do not copy into GitHub Pages: GitHub Pages cannot serve this middleware.
 *
 * Register this middleware BEFORE Firebase token verification on /api,
 * because CORS preflight OPTIONS requests carry no bearer token.
 * Existing downstream Firebase ID Token / admin claims / Firestore rules
 * remain authoritative for all real GET/POST requests.
 */
export const REPORT_ORIGIN = 'https://report.rifj.jp';
const ALLOW_METHODS = 'GET, POST, OPTIONS';
const ALLOW_HEADERS = 'Authorization, Content-Type';
export function originalApiCors(req,res,next){
  const origin = req.headers?.origin;
  // Always vary on Origin: authenticated and public APIs may be cached.
  if(typeof res.vary==='function')res.vary('Origin');
  else res.setHeader('Vary','Origin');
  if(!origin)return next(); // original Firebase-hosted app
  if(origin !== REPORT_ORIGIN){
    if(req.method === 'OPTIONS'){
      res.statusCode = 403;
      return res.end('Origin is not allowed');
    }
    return next(); // without CORS headers browser blocks cross-origin response
  }
  res.setHeader('Access-Control-Allow-Origin', REPORT_ORIGIN);
  if(req.method==='OPTIONS'){
    res.setHeader('Access-Control-Allow-Methods', ALLOW_METHODS);
    res.setHeader('Access-Control-Allow-Headers', ALLOW_HEADERS);
    res.setHeader('Access-Control-Max-Age', '600');
    res.statusCode=204;
    return res.end();
  }
  return next();
}
/*
 Example Express setup in the ORIGINAL API service:
   app.use('/api', originalApiCors);
   app.use('/api', existingAuthAndRoutes);

 This module is a handoff template, NOT a deployed or working proxy.
 */
