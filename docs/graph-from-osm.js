var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// get-osm-data/are-settings-correct.js
var require_are_settings_correct = __commonJS({
  "get-osm-data/are-settings-correct.js"(exports, module) {
    var exampleOfCorrectSettings = {
      bbox: [4.3841, 50.8127, 4.392, 50.8182],
      highways: ["primary", "secondary", "tertiary", "residential"],
      timeout: 6e8,
      maxContentLength: 15e8
    };
    var printError = (message) => {
      console.log("\n------------------------------------------------------------------------");
      console.log("ERROR in Graph-From-OSM: Invalid settings.\n");
      console.log(message + "\n");
      console.log("Example of correct settings: \n ");
      console.log(exampleOfCorrectSettings);
      console.log("------------------------------------------------------------------------\n");
    };
    var areSettingsCorrect = (settings = {}) => {
      if (!(settings.hasOwnProperty("bbox") && settings.hasOwnProperty("highways") && settings.hasOwnProperty("timeout") && settings.hasOwnProperty("maxContentLength"))) {
        printError('Settings object should pocess properties "bbox", "highways", "timeout" and "maxContentLength".');
        return false;
      }
      const { bbox, highways, timeout, maxContentLength } = settings;
      if (!(Array.isArray(bbox) && bbox.length === 4)) {
        printError("bbox should be an array of length 4.");
        return false;
      }
      if (!(-180 <= bbox[0] && bbox[0] < 180 && -180 <= bbox[2] && bbox[2] < 180)) {
        const line1 = "Longitude of bbox (bbox[0] and bbox[2]) should be a valid\n";
        const line2 = "geographical longitude between -180 and 180.";
        printError(line1 + line2);
        return false;
      }
      if (!(-90 <= bbox[1] && bbox[1] < 90 && -90 <= bbox[3] && bbox[3] < 90)) {
        const line1 = "Latitude of bbox (bbox[1] and bbox[3]) should be a valid\n";
        const line2 = "geographical latitude between -90 and 90.";
        printError(line1 + line2);
        return false;
      }
      if (highways !== "ALL") {
        if (!(Array.isArray(highways) && highways.length > 0)) {
          printError('highways should be a non-zero length array or highways = "ALL".');
          return false;
        }
        let allstrings = true;
        highways.forEach((highway) => {
          if (typeof highway !== "string") {
            allstrings = false;
          }
        });
        if (!allstrings) {
          printError('All elements of highways should be strings or highways = "ALL".');
          return false;
        }
      }
      if (!(Number.isInteger(timeout) && timeout > 0)) {
        printError("timeout should be a strictly positive integer");
        return false;
      }
      if (!(Number.isInteger(maxContentLength) && maxContentLength > 0)) {
        printError("maxContentLength should be a strictly positive integer");
        return false;
      }
      return true;
    };
    module.exports = { areSettingsCorrect };
  }
});

// get-osm-data/generate-osm-script.js
var require_generate_osm_script = __commonJS({
  "get-osm-data/generate-osm-script.js"(exports, module) {
    var { areSettingsCorrect } = require_are_settings_correct();
    var generateOsmScript = (settings) => {
      if (areSettingsCorrect(settings)) {
        const bbox = `${settings.bbox[1]}, ${settings.bbox[0]}, ${settings.bbox[3]}, ${settings.bbox[2]}`;
        let highways;
        if (settings.highways === "ALL") {
          highways = `	way[highway][!area];
`;
        } else {
          highways = settings.highways.reduce(
            (concatenation, d) => concatenation + `	way[highway=${d}][!area];
`,
            ""
          ).slice(0, -1);
        }
        const osmScript = `
  // OSM script to execute on https://overpass-turbo.eu or https://overpass-api.de/api/interpreter
  // Author: Matsvei Tsishyn
  // Settings --------------------------------------------------------------------
  [out:json][bbox:${bbox}][timeout:${settings.timeout}][maxsize:${settings.maxContentLength}];

  // Find all way elements -------------------------------------------------------
  (
    ${highways}
  )->.ways;

  // Find all of their node children elements ------------------------------------
  .ways; node(w)->.nodes;

  // Take the union --------------------------------------------------------------
  (
    .ways;
    .nodes;
  )->.all;

  // Export ----------------------------------------------------------------------
  .all out;`.slice(1);
        return osmScript;
      } else {
        return null;
      }
    };
    module.exports = { generateOsmScript };
  }
});

// get-osm-data/get-osm-data.js
var require_get_osm_data = __commonJS({
  "get-osm-data/get-osm-data.js"(exports, module) {
    var { generateOsmScript } = require_generate_osm_script();
    var getOsmData = async (settings) => {
      const osmScript = generateOsmScript(settings);
      const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "post",
        headers: { Accept: "application/json" },
        body: osmScript,
        signal: AbortSignal.timeout(settings.timeout)
      });
      const data = await response.json();
      data.generatingScript = osmScript;
      return data;
    };
    module.exports = { getOsmData };
  }
});

// osm-data-to-graph/tools.js
var require_tools = __commonJS({
  "osm-data-to-graph/tools.js"(exports, module) {
    var decomposeWaysToLinks = (ways, nodeId) => {
      const links = [];
      ways.forEach((way) => {
        const nodesOfWay = way.nodes;
        let firstNodeId = nodesOfWay[0];
        nodeId.get(firstNodeId).inGraph = true;
        let nodes = [firstNodeId];
        for (let i = 1; i < nodesOfWay.length - 1; i++) {
          const currentNodeId = way.nodes[i];
          const currentNode = nodeId.get(currentNodeId);
          nodes.push(currentNodeId);
          if (currentNode.adjLinksCount > 1) {
            currentNode.inGraph = true;
            const link2 = { ...way };
            link2.nodes = nodes;
            link2.src = firstNodeId;
            link2.tgt = currentNodeId;
            links.push(link2);
            nodes = [currentNodeId];
            firstNodeId = currentNodeId;
          }
        }
        const lastNodeId = nodesOfWay[nodesOfWay.length - 1];
        nodeId.get(lastNodeId).inGraph = true;
        nodes.push(lastNodeId);
        const link = { ...way };
        link.nodes = nodes;
        link.src = firstNodeId;
        link.tgt = lastNodeId;
        links.push(link);
      });
      return links;
    };
    var nodeToFeature = (node) => {
      return {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: node.coordinates
        },
        properties: {
          osmId: node.id,
          tags: node.tags || {}
        }
      };
    };
    var wayToFeature = (link, nodeId) => {
      const coordinates = link.nodes.map((d) => nodeId.get(d).coordinates);
      return {
        type: "Feature",
        src: link.src,
        tgt: link.tgt,
        geometry: {
          type: "LineString",
          coordinates
        },
        properties: {
          osmId: link.id,
          tags: link.tags || {}
        }
      };
    };
    var assignIds = (nodes, links) => {
      const osmIdToId = /* @__PURE__ */ new Map();
      nodes.forEach((node, i) => {
        node.id = i + 1;
        osmIdToId.set(node.properties.osmId, node.id);
      });
      const incrementForLinksIds = nodes.length + 1;
      links.forEach((link, i) => {
        link.id = i + incrementForLinksIds;
        link.src = osmIdToId.get(link.src);
        link.tgt = osmIdToId.get(link.tgt);
      });
    };
    module.exports = { decomposeWaysToLinks, nodeToFeature, wayToFeature, assignIds };
  }
});

// osm-data-to-graph/osm-data-to-graph.js
var require_osm_data_to_graph = __commonJS({
  "osm-data-to-graph/osm-data-to-graph.js"(exports, module) {
    var { decomposeWaysToLinks, nodeToFeature, wayToFeature, assignIds } = require_tools();
    var osmDataToGraph = (osmData) => {
      const graph = {
        type: "FeatureCollection",
        metaData: {
          source: "https://overpass-api.de/api/interpreter",
          version: osmData.version,
          generator: osmData.generator,
          osm3s: osmData.osm3s,
          generationgCodeAuthor: "Matsvei Tsishyn"
        },
        features: []
      };
      const elements = osmData.elements;
      const nodes = [], ways = [];
      const nodeId = /* @__PURE__ */ new Map();
      elements.forEach((element) => {
        if (element.type === "node") {
          const copyNode = {
            type: element.type,
            id: element.id,
            coordinates: [element.lon, element.lat],
            adjLinksCount: 0,
            // adjLinksCount count how may OSM ways pass trough this node
            inGraph: false,
            // indicate if we need to import this OSM node as a node in the graph
            tags: { ...element.tags }
          };
          nodes.push(copyNode);
          nodeId.set(copyNode.id, copyNode);
        } else if (element.type === "way") {
          const copyLink = {
            type: element.type,
            id: element.id,
            nodes: [...element.nodes],
            tags: { ...element.tags }
          };
          ways.push(copyLink);
        }
      });
      ways.forEach((way) => {
        way.nodes.forEach((node) => {
          nodeId.get(node).adjLinksCount++;
        });
      });
      const links = decomposeWaysToLinks(ways, nodeId);
      const pointFeatures = nodes.filter((d) => d.inGraph).map((d) => nodeToFeature(d));
      const lineStringFeatures = links.map((d) => wayToFeature(d, nodeId));
      assignIds(pointFeatures, lineStringFeatures);
      graph.features = pointFeatures.concat(lineStringFeatures);
      return graph;
    };
    module.exports = { osmDataToGraph };
  }
});

// index.js
var require_index = __commonJS({
  "index.js"(exports, module) {
    var { getOsmData } = require_get_osm_data();
    var { osmDataToGraph } = require_osm_data_to_graph();
    var graphFromOsm = {
      getOsmData,
      // Make an OSM query and recieve OSM data (asynchrone)
      osmDataToGraph
      // Transform OSM data into geojson graph  (synchrone)
    };
    module.exports = graphFromOsm;
  }
});
export default require_index();
