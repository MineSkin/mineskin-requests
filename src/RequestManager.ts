import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { JobQueue } from "jobqu";
import rateLimit, { rateLimitOptions } from "axios-rate-limit";
import { Time } from "@inventivetalent/time";
import { RequestConfig, RequestKey } from "./RequestConfig";
import { networkInterfaces } from "os";
import * as https from "node:https";
import { ProxyAgent } from "proxy-agent";


export const GENERIC = "generic";

const MAX_QUEUE_SIZE = 100;
const TIMEOUT = 10000;

axios.defaults.headers["User-Agent"] = "MineSkin";
axios.defaults.headers["Content-Type"] = "application/json";
axios.defaults.headers["Accept"] = "application/json";
axios.defaults.timeout = TIMEOUT;

export class RequestManager {

    public static IPS: string[] = [];

    static readonly axiosInstance: AxiosInstance = axios.create({});

    protected static readonly defaultRateLimit: rateLimitOptions = {
        maxRequests: 600,
        perMilliseconds: 10 * 60 * 1000
    }

    private static instances: Map<string, AxiosInstance> = new Map<string, AxiosInstance>();
    private static queues: Map<string, JobQueue<AxiosRequestConfig, AxiosResponse>> = new Map<string, JobQueue<AxiosRequestConfig, AxiosResponse>>();

    static init() {
        const interfaces = networkInterfaces();
        for (let id in interfaces) {
            const iface = interfaces[id];
            for (let address of iface) {
                if (address.internal) {
                    continue;
                }
                console.info(`${ address.family } ${ address.address } ${ address.mac }`);
                this.IPS.push(address.address);
            }
        }

        this.setupInstance(GENERIC, {});
        this.setupQueue(GENERIC, Time.millis(100), 1);
    }

    static registerInstance<K extends RequestKey>(config: RequestConfig<K>) {
        const key = this.mapKey(config.key);
        if (this.instances.has(key)) {
            console.warn(`Instance with key ${ key } already exists!`);
            return;
        }
        if (this.queues.has(key)) {
            console.warn(`Queue with key ${ key } already exists!`);
            return;
        }

        if (config?.ip?.bind) {
            const bind = config.ip.bind;
            if (!this.IPS.includes(bind)) {
                console.warn(`IP ${ bind } not found on this machine`);
            } else {
                console.info(`Binding ${ key } to IP ${ bind }`);
                config.request.httpsAgent = new https.Agent({
                    localAddress: config.ip.bind,
                    family: config.ip.bind.includes(":") ? 6 : 4
                });
            }
        }

        if (config.proxy) {
            console.info(`Setting up proxy for ${ key }`);
            config.request.httpsAgent = new ProxyAgent(config.proxy)
        }

        if (config.rateLimit) {
            this.setupInstance(key, config.request, c => rateLimit(axios.create(c), config.rateLimit));
        } else {
            this.setupInstance(key, config.request);
        }

        if (config.queue) {
            this.setupQueue(key, config.queue.interval, config.queue.maxPerRun);
        }
    }

    private static mapKey(key: RequestKey): string {
        if (typeof key === "string") {
            return key;
        }
        return JSON.stringify(key);
    }

    protected static setupInstance(key: string, config: AxiosRequestConfig, constr: AxiosConstructor = (c) => axios.create(c)) {
        this.instances.set(key, axios.create(config));
        console.log("set up axios instance " + key);
    }

    private static setupQueue(key: string, interval: number, maxPerRun: number): void {
        this.queues.set(key, new JobQueue<AxiosRequestConfig, AxiosResponse>(request => {
            return this.runAxiosRequest(request, key);
        }, interval, maxPerRun));
        console.log("set up request queue " + key);
    }

    protected static async runAxiosRequest(request: AxiosRequestConfig, inst: AxiosInstance | string = this.axiosInstance): Promise<AxiosResponse> {
        let instance: AxiosInstance;
        if (typeof inst === "string") {
            instance = this.instances.get(inst);
        } else {
            instance = inst as AxiosInstance;
        }

        if (!instance) {
            throw new Error("No instance found for key " + inst);
        }

        console.log(`=> ${ request.method } ${ request.url }`)

        return instance.request(request);
    }

    public static async dynamicRequest<K extends RequestKey>(key: K, request: AxiosRequestConfig): Promise<AxiosResponse> {
        const k = this.mapKey(key);
        const q = this.queues.get(k);
        if (!q) {
            throw new Error("No queue found for key " + k);
        }

        if (q.size > MAX_QUEUE_SIZE) {
            console.warn(`Rejecting new request as queue for ${ k } is full (${ q.size })! `);
            throw new Error("Request queue is full!");
        }
        return await q.add(request);
    }

}

type AxiosConstructor = (config: AxiosRequestConfig) => AxiosInstance;
