import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, CreateAxiosDefaults } from "axios";
import { JobQueue } from "jobqu";
import rateLimit, { rateLimitOptions } from "axios-rate-limit";
import { Time } from "@inventivetalent/time";
import { RequestConfig, RequestKey } from "./RequestConfig";
import { networkInterfaces } from "os";
import * as https from "node:https";
import { HttpsProxyAgent } from "https-proxy-agent";
import { Breadcrumb } from "@mineskin/types";
import { Address4, Address6 } from "ip-address";
import { isPublicNetworkInterface } from "./util";
import * as Sentry from "@sentry/node";

export const GENERIC = "generic";


const MAX_QUEUE_SIZE = 100;
const TIMEOUT = 10000;

axios.defaults.headers["User-Agent"] = "MineSkin";
axios.defaults.headers["Content-Type"] = "application/json";
axios.defaults.headers["Accept"] = "application/json";
axios.defaults.timeout = TIMEOUT;

export class RequestManager {

    public static IPS: string[] = [];

    static readonly axiosInstance: AxiosInstance = RequestManager.createAxiosInstance({});

    protected static readonly defaultRateLimit: rateLimitOptions = {
        maxRequests: 600,
        perMilliseconds: 10 * 60 * 1000
    }

    private static instances: Map<string, AxiosInstance> = new Map<string, AxiosInstance>();
    private static queues: Map<string, JobQueue<AxiosRequestConfig, AxiosResponse>> = new Map<string, JobQueue<AxiosRequestConfig, AxiosResponse>>();

    static init() {
        const interfaces = networkInterfaces();
        i: for (let id in interfaces) {
            const iface = interfaces[id];
            a: for (let address of iface) {
                if (!isPublicNetworkInterface(address)) {
                    continue i; // skip interface
                }

                console.info(`${ address.family } ${ address.address } ${ address.netmask } ${ address.mac } ${ address.cidr }`);
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
            console.info(`Setting up proxy for ${ key } via ${ config.proxy.host }`);
            config.request.httpsAgent = new HttpsProxyAgent(config.proxy)
        }

        if (config.rateLimit) {
            this.setupInstance(key, config.request, c => rateLimit(this.createAxiosInstance(c), config.rateLimit));
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

    protected static createAxiosInstance(config: CreateAxiosDefaults) {
        const instance = axios.create(config);
        instance.interceptors.response.use((response) => response, (error) => {
            const is429 = error.response?.status === 429;
            console.error(`Error in Axios API, status ${ error.response?.status } ${ is429 ? "(429)" : "" }`);
            console.error(error.config?.url);
            console.error(JSON.stringify(error.response?.data || error.response, null, 2));
            console.error(JSON.stringify(error.request?.data, null, 2));
            Sentry.captureException(error, {
                level: is429 ? 'fatal' : 'error',
                extra: {
                    responseCode: error.response?.status,
                    endpoint: error.config?.url
                }
            });
            throw error;
        });
        return instance;
    }

    protected static setupInstance(key: string, config: AxiosRequestConfig, constr: AxiosConstructor = (c) => this.createAxiosInstance(c)) {
        this.instances.set(key, constr(config));
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
        let instanceKey: string = "default";
        if (typeof inst === "string") {
            instance = this.instances.get(inst);
            instanceKey = inst;
        } else {
            instance = inst as AxiosInstance;
        }

        if (!instance) {
            throw new Error("No instance found for key " + inst);
        }

        let breadcrumb = request.headers?.["X-MineSkin-Breadcrumb"] || "00000000";
        console.log(`${ breadcrumb } => ${ request.method } ${ request.url } via ${ instanceKey }`);

        return instance.request(request);
    }

    public static async dynamicRequest<K extends RequestKey>(key: K, request: AxiosRequestConfig, breadcrumb?: Breadcrumb): Promise<AxiosResponse> {
        const k = this.mapKey(key);
        const q = this.queues.get(k);

        if (breadcrumb) {
            request.headers = request.headers || {};
            request.headers["X-MineSkin-Breadcrumb"] = breadcrumb;
        }

        if (!q) {
            return this.runAxiosRequest(request, k);
            //throw new Error("No queue found for key " + k);
        }

        if (q.size > MAX_QUEUE_SIZE) {
            console.warn(`${ breadcrumb } Rejecting new request as queue for ${ k } is full (${ q.size })! `);
            throw new Error("Request queue is full!");
        }
        return await q.add(request);
    }

}

type AxiosConstructor = (config: AxiosRequestConfig) => AxiosInstance;
