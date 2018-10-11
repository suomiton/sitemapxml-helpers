const axios = require("axios");
const { Parser } = require("xml2js");
const { createLogger, format, transports } = require("winston");
require("dotenv").config();

/*  
  * Arguments
  ! [0]:search-term
    [1]:sitemap to search from
    [2]:logging-level
*/

const args = process.argv.slice(2);
const searchTerm = args[0];

const logger = createLogger({
  level: args[2] || "info",
  format: format.combine(format.colorize(), format.simple()),
  transports: [new transports.Console()]
});

if (!searchTerm || searchTerm.length < 6) {
  logger.error("Search term empty or too short");
  process.exit();
}

const get = async url => {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (e) {
    logger.error(e);
  }
};

const parseXml = (xml, next) => {
  const parser = new Parser();
  parser.parseString(xml, (_, json) => next(json));
};

const logFoundResult = url => logger.info(`* ${url}`);

const filterSitemapUrls = sitemapObj =>
  sitemapObj.urls.filter(u => u.includes(searchTerm));

const processSitemap = sitemapObj => {
  logger.verbose(`Searching ${sitemapObj.sitemap}`);
  const foundUrls = filterSitemapUrls(sitemapObj);
  if (foundUrls.length) {
    logger.info(`Url(s) found from ${sitemapObj.sitemap}:`);
    foundUrls.forEach(logFoundResult);
  }
};

const mapSitemapObject = (url, sitemapJson) => ({
  sitemap: url,
  urls: sitemapJson.urlset.url.map(u => u.loc[0])
});

const requestSitemap = async (url, index) => {
  logger.verbose(`${index}: Fetching ${url}`);
  const xml = await get(url);

  parseXml(xml, json => {
    logger.debug(`${index}: %o`, json);
    processSitemap(mapSitemapObject(url, json));
  });
};

const iterateSitemapIndex = (sitemapObject, url) =>
  sitemapObject.hasOwnProperty("sitemapindex")
    ? sitemapObject.sitemapindex.sitemap.forEach((s, i) =>
        s.loc.forEach(async url => await requestSitemap(url, i))
      )
    : processSitemap(mapSitemapObject(url, sitemapObject));

const main = async sitemapUrl => {
  logger.verbose(`Searching for ${searchTerm} from ${sitemapUrl}`);
  const xml = await get(sitemapUrl);
  parseXml(xml, json => iterateSitemapIndex(json, sitemapUrl));
};

main(args[1] || process.env.BASE_SITEMAP);
