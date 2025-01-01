const { generateOsmScript } = require('./generate-osm-script.js');


/*
--------------------------------------------------------------------------------
Send a query to https://overpass-api.de/api/interpreter and take back the
recieved data.

Input: settings object (cf to ./generate-osm-script.js)
Output: OSM data
--------------------------------------------------------------------------------
*/


const getOsmData = async (settings) => {
  const osmScript = generateOsmScript(settings);
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'post',
    headers: { Accept: 'application/json' },
    body: osmScript,
    signal: AbortSignal.timeout(settings.timeout),
  })
  const data = await response.json();
  data.generatingScript = osmScript;
  return data;
}



module.exports = { getOsmData };
