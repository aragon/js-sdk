import { Random } from "@aragon/sdk-common";
import { Context } from "../../context";
import { IClientIpfsCore } from "../interfaces/core";
import { Client as IpfsClient } from "@aragon/sdk-ipfs";

export class IPFSModule implements IClientIpfsCore {
    private _ipfs: IpfsClient[] = [];
    private _ipfsIdx: number = -1;

    constructor(context: Context) {
        if (context.ipfs?.length) {
            this._ipfs = context.ipfs;
            this._ipfsIdx = Math.floor(Random.getFloat() * context.ipfs.length);
        }
    }

    public getClient(): IpfsClient {
        if (!this._ipfs[this._ipfsIdx]) {
            throw new Error("No IPFS endpoints available");
        }
        return this._ipfs[this._ipfsIdx];
    }

    /**
     * Starts using the next available IPFS endpoint
     */
    public shiftClient(): void {
        if (!this._ipfs?.length) {
            throw new Error("No IPFS endpoints available");
        } else if (this._ipfs?.length < 2) {
            throw new Error("No other endpoints");
        }
        this._ipfsIdx = (this._ipfsIdx + 1) % this._ipfs?.length;
    }

    /** Returns `true` if the current client is on line */
    public isUp(): Promise<boolean> {
        if (!this._ipfs?.length) return Promise.resolve(false);
        return this.getClient().nodeInfo().then(() => true).catch(() => false)
    }

    public async ensureOnline(): Promise<void> {
        if (!this._ipfs?.length) {
            return Promise.reject(new Error("IPFS client is not initialized"));
        }

        for (let i = 0; i < this._ipfs?.length; i++) {
            if (await this.isUp()) return;

            this.shiftClient();
        }
        throw new Error("No IPFS nodes available");
    }

    public getOnlineClient(): Promise<IpfsClient> {
        return this.ensureOnline().then(() => this.getClient());
    }

    // IPFS METHODS

    public async add(input: string | Uint8Array): Promise<string> {
        return this.getOnlineClient().then(
            client => client.add(input).then(res => res.hash)
        ).catch(e => {
            throw new Error(`Could not upload data: ${e?.message || ''}`)
        })
    }

    public fetchBytes(cid: string): Promise<Uint8Array | undefined> {
        return this.getOnlineClient().then(client => client.cat(cid));
    }

    public fetchString(cid: string): Promise<string> {
        return this.fetchBytes(cid)
            .then((bytes) => new TextDecoder().decode(bytes))
            .catch((e) => {
                throw new Error(`Could not upload data: ${e?.message || ''}`)
            });
    }
}