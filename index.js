const path = require("path");
const fs = require("fs");
const puppeteer = require("puppeteer");

function getTimingForRequest(url, tracing) {
  const requestSendEvent = tracing.traceEvents.find(
    (x) =>
      x.cat === "devtools.timeline" &&
      typeof x.args.data !== "undefined" &&
      typeof x.args.data.url !== "undefined" &&
      x.args.data.url === url &&
      x.name === "ResourceSendRequest"
  );
  const requestEndEvent = tracing.traceEvents.find(
    (x) =>
      x.cat === "devtools.timeline" &&
      typeof x.args.data !== "undefined" &&
      typeof x.args.data.requestId !== "undefined" &&
      x.args.data.requestId === requestSendEvent.args.data.requestId &&
      x.name === "ResourceFinish"
  );

  const startTime = requestSendEvent.ts / 1000; // convert microseconds to milliseconds
  const endTime = requestEndEvent.ts / 1000; // convert microseconds to milliseconds
  const duration = endTime - startTime;

  return {
    startTime,
    endTime,
    duration,
    url,
  };
}

function logTimingInfo(tracingFilePath) {
  const tracing = JSON.parse(
    fs.readFileSync(tracingFilePath, "utf8")
  );

  const urls = tracing.traceEvents.reduce((accum, e) => {
    try {
      const url = e.args.data.url;
      if (url.startsWith("https")) {
        accum.add(url);
      }
      return accum;
    } catch {
      return accum;
    }
  }, new Set());

  console.log(Array.from(urls).map((url) => getTimingForRequest(url, tracing)));
}

exports.run = async (_, res) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const tracingFilePath = path.join("/", "tmp", "tracing.json");
  await page.tracing.start({ path: tracingFilePath });

  const htmlContent = fs.readFileSync(
      path.join(__dirname, "index.html"),
      "utf8"
  );
  await page.setContent(htmlContent, {
    timeout: 5000,
    waitUntil: "networkidle0",
  }); // close page after 5 sec, then report

  await page.tracing.stop();

  logTimingInfo(tracingFilePath);

  await browser.close();
  res.sendStatus(200);
};
