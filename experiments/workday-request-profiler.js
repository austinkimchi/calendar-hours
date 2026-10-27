/* Development-only fetch profiler. Records durations and byte counts, never
 * URLs, request bodies, response content, tokens or employee information. */
(function(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CalendarHoursRequestProfiler = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function() {
  "use strict";
  function create({ fetcher = fetch, timing = performance } = {}) {
    const measurements = [];
    async function measuredFetch(url, options) {
      const params = options.body instanceof URLSearchParams ? options.body : null;
      const kind = !options.method ? "calendar" : params?.has("_eventId_validate") ? "validate" :
        params?.has("_eventId_submit") ? "save" : params?.has("_eventId_cancel") ? "cancel" : "open";
      const start = timing.now();
      const response = await fetcher(url, options);
      const headersAt = timing.now();
      return {
        ok: response.ok, status: response.status,
        async json() {
          const body = await response.text();
          const bodyAt = timing.now();
          const data = JSON.parse(body);
          const parsedAt = timing.now();
          const resource = timing.getEntriesByName?.(url, "resource").filter(e => e.startTime >= start - 1).at(-1);
          measurements.push({
            kind, status: response.status, toHeaders: headersAt - start,
            bodyRead: bodyAt - headersAt, parse: parsedAt - bodyAt, total: parsedAt - start,
            decodedBytes: new TextEncoder().encode(body).length,
            ...(resource ? {
              resource: {
                duration: resource.duration, ttfb: resource.responseStart - resource.requestStart,
                download: resource.responseEnd - resource.responseStart,
                dns: resource.domainLookupEnd - resource.domainLookupStart,
                connect: resource.connectEnd - resource.connectStart,
                transferBytes: resource.transferSize, encodedBytes: resource.encodedBodySize,
                protocol: resource.nextHopProtocol,
                serverTiming: (resource.serverTiming || []).map(t => ({name:t.name,duration:t.duration}))
              }
            } : {})
          });
          return data;
        }
      };
    }
    return { fetcher: measuredFetch, measurements };
  }
  return { create };
});
