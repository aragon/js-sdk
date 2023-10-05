import { IPFS_CID_REGEX } from "./constants";

/**
 * Parses a multi URI and returns the IPFS or HTTP URI.
 *
 * @export
 * @class MultiUri
 */
export class MultiUri {
  readonly items: string[] = [];

  constructor(multiUri: string) {
    if (!multiUri) throw new Error("The multi URI is empty");
    this.items = multiUri.split(",");
  }

  get ipfsCid() {
    for (let item of this.items) {
      if (IPFS_CID_REGEX.test(item)) return item;
      else if (item.startsWith("ipfs://")) {
        item = item.substring(7);
      }
      const idx = item.indexOf("/");
      const cid = (idx < 0) ? item : item.substring(0, idx);

      if (!IPFS_CID_REGEX.test(cid)) continue;
      return cid;
    }
    return null;
  }
  get ipfs() {
    for (let item of this.items) {
      if (IPFS_CID_REGEX.test(item)) return { cid: item, path: "" };
      else if (item.startsWith("ipfs://")) {
        item = item.substring(7);
      }
      let pathIdx = item.indexOf("/");

      let cid = item;
      if (pathIdx < 0) {
        if (!IPFS_CID_REGEX.test(cid)) continue;
        return { cid, path: "" };
      }
      cid = item.substring(0, pathIdx);
      if (!IPFS_CID_REGEX.test(cid)) continue;

      let searchIdx = item.indexOf("?");
      if (searchIdx < 0) searchIdx = item.indexOf("#");

      if (searchIdx < 0) {
        return {
          cid,
          path: item.substring(pathIdx),
        };
      }

      return {
        cid,
        path: item.substring(pathIdx, searchIdx),
      };
    }
    return null;
  }
  get http() {
    return this.items.filter((item) =>
      item.startsWith("http://") || item.startsWith("https://")
    );
  }
}

/** Attempts to parse the given string as a URL and returns the IPFS CiD contained in it.
 * Alternatively it tries to use the raw value after validating it.
 */
