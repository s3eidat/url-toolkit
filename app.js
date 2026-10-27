/* URL Toolkit — the browser's own URL parser plus encodeURIComponent/encodeURI. Nothing is fetched. */
(function () {
  "use strict";
  var $ = S3.$, $$ = S3.$$;
  var TRACKING = /^(utm_[a-z0-9_]+|fbclid|gclid|gclsrc|dclid|gbraid|wbraid|msclkid|mc_cid|mc_eid|igshid|igsh|yclid|twclid|ttclid|li_fat_id|_ga|_gl|_hsenc|_hsmi|__hstc|__hssc|__hsfp|hsctatracking|mkt_tok|oly_anon_id|oly_enc_id|vero_id|rb_clickid|s_cid|ef_id|srsltid)$/i;

  // ---------- core ----------
  function dec(s, plus) {
    if (plus) s = s.replace(/\+/g, " ");
    return decodeURIComponent(s); // throws URIError on broken % sequences
  }
  function safeDec(s) { try { return dec(s, true); } catch (e) { return s; } }
  // Query string → [[key, value|null]], keeping order, duplicates and bare flags.
  function parseQuery(q) {
    q = q.replace(/^\?/, "");
    if (!q) return [];
    return q.split("&").filter(Boolean).map(function (p) {
      var i = p.indexOf("=");
      return i < 0 ? [safeDec(p), null] : [safeDec(p.slice(0, i)), safeDec(p.slice(i + 1))];
    });
  }
  function buildQuery(params) {
    return params.filter(function (p) { return p[0] !== "" || p[1]; }).map(function (p) {
      return encodeURIComponent(p[0]) + (p[1] == null ? "" : "=" + encodeURIComponent(p[1]));
    }).join("&");
  }
  function toURL(text) {
    var s = String(text).trim();
    if (!s) return null;
    var u = null;
    try { u = new URL(s); } catch (e) { /* maybe no scheme */ }
    if (!u && !/^[a-z][a-z0-9+.-]*:/i.test(s)) { try { u = new URL("https://" + s); } catch (e2) { /* invalid */ } }
    return u && !/[%\s]/.test(u.hostname) ? u : null; // Chromium tolerates spaces in hosts; we don't
  }
  function withQuery(u, params) {
    var c = new URL(u.href), q = buildQuery(params);
    c.search = q ? "?" + q : "";
    return c.href;
  }
  function stripTracking(href) {
    var u = toURL(href); if (!u) return null;
    var params = parseQuery(u.search), kept = params.filter(function (p) { return !TRACKING.test(p[0]); });
    // Leave untouched query strings byte-for-byte when nothing is removed.
    return { href: kept.length === params.length ? u.href : withQuery(u, kept), removed: params.length - kept.length };
  }

  // ---------- parse UI ----------
  var urlEl = $("#url"), st = { u: null, params: [] };
  function partRow(k, v, note) {
    return S3.h("tr", null, [S3.h("th", { text: k }), S3.h("td", null, [v === "" ? S3.h("span", { "class": "faint", text: "—" }) : S3.h("span", { "class": "mono", text: v }), note ? S3.h("div", { "class": "faint", text: note }) : null])]);
  }
  function drawParts() {
    var tb = $("#parts"), u = st.u; tb.textContent = "";
    if (!u) { tb.appendChild(S3.h("tr", null, [S3.h("td", { "class": "faint", text: "Paste a URL to see its parts." })])); return; }
    var defPort = { "http:": "80", "https:": "443", "ftp:": "21", "ws:": "80", "wss:": "443" }[u.protocol];
    var path = u.pathname, dpath = safeDec(path.replace(/\+/g, "%2B"));
    [
      ["Protocol", u.protocol.replace(/:$/, "")],
      ["Username", u.username ? safeDec(u.username) : ""],
      ["Password", u.password ? "•".repeat(Math.min(12, u.password.length)) : "", u.password ? "Hidden here. Never share URLs that contain passwords." : ""],
      ["Host", u.hostname],
      ["Port", u.port, !u.port && defPort ? "default (" + defPort + ")" : ""],
      ["Path", path, dpath !== path ? "decoded: " + dpath : ""],
      ["Query", u.search.replace(/^\?/, "")],
      ["Fragment", u.hash.replace(/^#/, ""), u.hash && safeDec(u.hash.slice(1)) !== u.hash.slice(1) ? "decoded: " + safeDec(u.hash.slice(1)) : ""],
      ["Origin", u.origin === "null" ? "" : u.origin]
    ].forEach(function (r) { tb.appendChild(partRow(r[0], r[1], r[2])); });
  }
  function drawParams() {
    var box = $("#params"); box.textContent = "";
    var n = st.params.length, tracked = st.params.filter(function (p) { return TRACKING.test(p[0]); }).length;
    $("#qCount").textContent = n ? "(" + n + (tracked ? ", " + tracked + " tracking" : "") + ")" : "";
    if (!n) { box.appendChild(S3.h("div", { "class": "empty ut-empty" }, [st.u ? "No query parameters." : "Parameters appear here."])); return; }
    st.params.forEach(function (p, i) {
      var isT = TRACKING.test(p[0]);
      var k = S3.h("input", { "class": "input mono", value: p[0], "aria-label": "Key " + (i + 1), spellcheck: "false" });
      var v = S3.h("input", { "class": "input mono", value: p[1] == null ? "" : p[1], "aria-label": "Value " + (i + 1), spellcheck: "false", dir: "auto", placeholder: p[1] == null ? "(no value)" : "" });
      k.addEventListener("input", function () { p[0] = k.value; row.classList.toggle("is-track", TRACKING.test(k.value)); rebuild(); });
      v.addEventListener("input", function () { p[1] = v.value === "" && p[1] == null ? null : v.value; rebuild(); });
      var row = S3.h("div", { "class": "ut-param" + (isT ? " is-track" : "") }, [k, S3.h("span", { "class": "ut-eq", text: "=" }), v,
        S3.h("button", { "class": "btn ghost small icon", title: "Remove " + p[0], "aria-label": "Remove parameter " + (i + 1), html: '<svg class="i"><use href="#i-x"/></svg>', onclick: function () {
          st.params.splice(i, 1); rebuild(); drawParams();
        } })]);
      box.appendChild(row);
    });
  }
  function rebuild() {
    if (!st.u) return;
    urlEl.value = withQuery(st.u, st.params);
    st.u = toURL(urlEl.value);
    drawParts(); status();
  }
  function status() {
    var c = $("#urlStatus");
    if (!urlEl.value.trim()) { c.className = "chip"; c.textContent = "Waiting for a URL"; return; }
    if (!st.u) { c.className = "chip bad"; c.textContent = "Not a valid URL"; return; }
    var t = st.params.filter(function (p) { return TRACKING.test(p[0]); }).length;
    c.className = "chip " + (t ? "warn" : "ok"); c.textContent = t ? t + " tracking parameter" + (t > 1 ? "s" : "") : "✓ Valid, no tracking";
  }
  function parseNow() {
    st.u = toURL(urlEl.value);
    st.params = st.u ? parseQuery(st.u.search) : [];
    S3.store("url.last", urlEl.value);
    drawParts(); drawParams(); status();
  }
  urlEl.addEventListener("input", S3.debounce(parseNow, 120));
  $("#strip").addEventListener("click", function () {
    var r = stripTracking(urlEl.value);
    if (!r) { S3.toast("Paste a valid URL first", "error"); return; }
    urlEl.value = r.href; parseNow();
    S3.toast(r.removed ? "Removed " + r.removed + " tracking parameter" + (r.removed > 1 ? "s" : "") : "No tracking parameters found");
    if (r.removed) S3.done();
  });
  $("#addParam").addEventListener("click", function () {
    if (!st.u) { S3.toast("Paste a valid URL first", "error"); return; }
    st.params.push(["", ""]); drawParams();
    var ins = $$("#params .ut-param input"); ins[ins.length - 2].focus();
  });
  $("#copyUrl").addEventListener("click", function () { if (urlEl.value.trim()) { S3.copy(urlEl.value.trim(), "URL copied"); S3.done(); } });
  $("#clearUrl").addEventListener("click", function () { urlEl.value = ""; parseNow(); urlEl.focus(); });
  var SAMPLE = "https://s3eidat.github.io/shop/item?id=42&color=sky%20blue&utm_source=newsletter&utm_medium=email&utm_campaign=autumn_sale&fbclid=IwAR0xYz&q=caf%C3%A9#reviews";
  $("#sample").addEventListener("click", function () { urlEl.value = SAMPLE; parseNow(); });

  // ---------- encode / decode UI ----------
  var mode = S3.store("url.mode") || "component", encIn = $("#encIn"), encOut = $("#encOut");
  $$("#mode button").forEach(function (b) {
    b.setAttribute("aria-pressed", String(b.dataset.v === mode));
    b.addEventListener("click", function () {
      $$("#mode button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      mode = b.dataset.v; S3.store("url.mode", mode);
    });
  });
  function encStatus(cls, t) { var c = $("#encStatus"); c.className = "chip " + cls; c.textContent = t; }
  function encode(s, m) { return m === "full" ? encodeURI(s) : encodeURIComponent(s); }
  function decode(s, m, plus) { if (plus) s = s.replace(/\+/g, " "); return m === "full" ? decodeURI(s) : decodeURIComponent(s); }
  $("#encode").addEventListener("click", function () {
    try { encOut.value = encode(encIn.value, mode); encStatus("ok", "Encoded"); S3.done(); }
    catch (e) { encStatus("bad", "Can't encode: the text has a broken surrogate pair"); }
  });
  $("#decode").addEventListener("click", function () {
    try { encOut.value = decode(encIn.value, mode, $("#plus").checked); encStatus("ok", "Decoded"); S3.done(); }
    catch (e) { encStatus("bad", "Malformed %-sequence — check for a lone % or a cut-off code"); }
  });
  $("#copyEnc").addEventListener("click", function () { if (encOut.value) { S3.copy(encOut.value); S3.done(); } });

  urlEl.value = S3.store("url.last") || "";
  parseNow();

  window.S3_DEMO = function () {
    urlEl.value = SAMPLE; parseNow();
    encIn.value = "café & crème / 50% off?"; $("#encode").click();
  };

  window.S3_SELFTEST = function () {
    if (encode("a b&c/d?é", "component") !== "a%20b%26c%2Fd%3F%C3%A9") return "component";
    if (encode("a b&c/d?é", "full") !== "a%20b&c/d?%C3%A9") return "full";
    if (decode("x+y%20%E2%9C%93", "component", true) !== "x y ✓" || decode("x+y", "component", false) !== "x+y") return "decode";
    try { decode("%E2%9C", "component"); return "malformed accepted"; } catch (e) { /* expected */ }
    if (JSON.stringify(parseQuery("?a=1&b=x+y&flag&c=%E2%9C%93&a=2")) !== '[["a","1"],["b","x y"],["flag",null],["c","✓"],["a","2"]]') return "parseQuery";
    if (buildQuery([["a", "1"], ["flag", null], ["sp ace", "é&"]]) !== "a=1&flag&sp%20ace=%C3%A9%26") return "buildQuery";
    var r = stripTracking(SAMPLE);
    if (r.removed !== 4 || r.href !== "https://s3eidat.github.io/shop/item?id=42&color=sky%20blue&q=caf%C3%A9#reviews") return "strip " + r.href;
    if (stripTracking("https://s3eidat.github.io/?utm_source=x").href !== "https://s3eidat.github.io/") return "strip all";
    if (stripTracking("https://s3eidat.github.io/?b=a+b").removed !== 0 || stripTracking("https://s3eidat.github.io/?b=a+b").href.indexOf("a+b") < 0) return "untouched";
    if (!toURL("s3eidat.github.io/tools") || toURL("s3eidat.github.io/tools").protocol !== "https:" || toURL("not a url at all")) return "toURL";
    return true;
  };
})();
