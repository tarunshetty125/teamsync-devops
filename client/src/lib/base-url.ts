export const baseURL = import.meta.env.VITE_API_BASE_URL;

export const getApiAssetUrl = (pathOrUrl?: string | null) => {
  if (!pathOrUrl) return "";
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;

  return `${baseURL.replace(/\/$/, "")}${
    pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`
  }`;
};
