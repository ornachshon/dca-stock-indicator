export async function getYahooCrumbSession() {
  const cookieRes = await fetch("https://fc.yahoo.com", {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const setCookie = cookieRes.headers.getSetCookie?.() ?? [];
  let cookie = setCookie.map((entry) => entry.split(";")[0]).join("; ");

  if (!cookie) {
    const rawSetCookie = cookieRes.headers.get("set-cookie");
    if (rawSetCookie) {
      cookie = rawSetCookie
        .split(/,(?=\s*[A-Za-z_][A-Za-z0-9_-]*=)/)
        .map((part) => part.split(";")[0].trim())
        .filter(Boolean)
        .join("; ");
    }
  }

  if (!cookie) {
    throw new Error("Failed to get Yahoo session cookie");
  }

  const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: { "User-Agent": "Mozilla/5.0", Cookie: cookie },
  });

  const crumb = (await crumbRes.text()).trim();
  if (!crumbRes.ok || !crumb || crumb.startsWith("{")) {
    throw new Error("Failed to get Yahoo crumb");
  }

  return { cookie, crumb };
}
