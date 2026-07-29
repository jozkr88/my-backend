const trimTrailingSlash = (value = "") => value.replace(/\/+$/, "");

export const appBasePath = trimTrailingSlash(process.env.PUBLIC_URL || "");

export function appPath(path = "/") {
  if (!path) return appBasePath || "/";

  if (
    /^(?:[a-z]+:)?\/\//i.test(path) ||
    path.startsWith("mailto:") ||
    path.startsWith("tel:") ||
    path.startsWith("#")
  ) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${appBasePath}${normalizedPath}` || normalizedPath;
}

export function assetUrl(path) {
  return appPath(path);
}
