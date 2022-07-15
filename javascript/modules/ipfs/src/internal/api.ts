import { IpfsClient } from "./client";
import {
  AddOptions,
  CatOptions,
  Config,
  NodeInfoOptions,
  VersionOptions,
  PinOptions,
  UnpinOptions,
} from "../interfaces";
import { Network } from "./network";
import {
  AddResponse,
  PinResponse,
  VersionResponse,
  NodeInfoResponse,
} from "../typings";
import { Helpers } from "./helpers";

export namespace API {
  /** Gets cluster version */
  export function version(
    cluster: IpfsClient,
    options: VersionOptions = {}
  ): Promise<VersionResponse> {
    return Network.request(cluster, "version", {
      method: "POST",
      params: Helpers.getVersionParams(options),
      signal: options.signal,
    })
      .then(response => {
        return Helpers.toVersionResponse(response);
      })
      .catch(e => {
        throw Helpers.handleError(e);
      });
  }

  /** Gets the cluster information */
  export function nodeInfo(
    cluster: IpfsClient,
    options = {} as NodeInfoOptions
  ): Promise<NodeInfoResponse> {
    return Network.request(cluster, "id", {
      method: "POST",
      params: Helpers.getNodeInfoParams(options),
      signal: options.signal,
    })
      .then(response => {
        return Helpers.toNodeInfoResponse(response);
      })
      .catch(e => {
        throw Helpers.handleError(e);
      });
  }

  /** Import a file to the cluster */
  export function add(
    cluster: Config,
    file: File | Blob | string,
    options: AddOptions = {}
  ): Promise<AddResponse> {
    if (
      !(file instanceof File) &&
      !(file instanceof Blob) &&
      typeof file !== "string"
    ) {
      throw new Error("Invalid file");
    }
    const body = new FormData();
    if (typeof file === "string") {
      body.append("path", file);
    } else {
      body.append("path", file, getName(file) || "file");
    }
    return Network.request(cluster, "add", {
      params: Helpers.getAddParams(options),
      method: "POST",
      body,
      signal: options.signal,
    })
      .then(response => {
        return Helpers.toAddResponse(response);
      })
      .catch(e => {
        throw Helpers.handleError(e);
      });
  }
  export async function cat(
    cluster: Config,
    path: string,
    options: CatOptions = {}
  ): Promise<Uint8Array> {
    if (!path) {
      throw new Error("Invalid CID");
    }
    const stream = Network.stream(cluster, "cat", {
      method: "POST",
      params: {
        ...Helpers.getCatParams(options),
        arg: path,
      },
      signal: options.signal,
    });
    return Helpers.streamToUInt8Array(stream);
  }

  /** Pins the given CID or IPFS/IPNS path to the cluster */
  export function pin(
    cluster: IpfsClient,
    path: string,
    options: PinOptions = {}
  ): Promise<PinResponse> {
    return Network.request(cluster, "pin/add", {
      params: {
        ...Helpers.getPinOptions(options),
        arg: path,
      },
      method: "POST",
      signal: options.signal,
    });
  }

  /** Unpins the given CID or IPFS/IPNS path from the cluster */
  export function unpin(
    cluster: IpfsClient,
    path: string,
    options: UnpinOptions = {}
  ): Promise<PinResponse> {
    return Network.request(cluster, "pin/rm", {
      params: {
        ...Helpers.getUnpinOptions(options),
        arg: path,
      },
      method: "POST",
      signal: options.signal,
    });
  }
}

const getName = (file: File | (Blob & { name?: string })) => file.name;
