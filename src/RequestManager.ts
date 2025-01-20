import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, CreateAxiosDefaults } from "axios";
import { JobQueue } from "jobqu";
import rateLimit, { rateLimitOptions } from "axios-rate-limit";
import { Time } from "@inventivetalent/time";
import { RequestConfig, RequestKey } from "./RequestConfig";
import { networkInterfaces } from "os";
import * as https from "node:https";
import { HttpsProxyAgent } from "https-proxy-agent";
import { Breadcrumb } from "@mineskin/types";
import { isPublicNetworkInterface } from "./util";
import * as Sentry from "@sentry/node";
import { IRequestExecutor } from "@mineskin/core";
import { inject, injectable } from "inversify";
import { ICredentialService, ILogProvider, IMetricsProvider, TYPES as CoreTypes } from "@mineskin/core";
import winston from "winston";

export const GENERIC = "generic";

const MAX_QUEUE_SIZE = 100;
const TIMEOUT = 10000;

@injectable()
export class RequestManager implements IRequestExecutor {

    public static IPS: Set<string> = new Set<string>();

    readonly defaultInstance: AxiosInstance = this.createAxiosInstance({});

    protected static readonly defaultRateLimit: rateLimitOptions = {
        maxRequests: 600,
        perMilliseconds: 10 * 60 * 1000
    }

    protected readonly instances: Map<string, AxiosInstance> = new Map<string, AxiosInstance>();
    protected readonly queues: Map<string, JobQueue<AxiosRequestConfig, AxiosResponse>> = new Map<string, JobQueue<AxiosRequestConfig, AxiosResponse>>();

    private static _instance: RequestManager;

    readonly logger: winston.Logger;

    /**@deprecated**/
    static get instance(): RequestManager {
        if (!this._instance) {
            console.trace("Creating new RequestManager instance");
            this._instance = new RequestManager(undefined, undefined);
        }
        return this._instance;
    }

    /**@deprecated**/
    static init() {
        RequestManager.instance;
    }

    /**@deprecated**/
    static get axiosInstance(): AxiosInstance {
        return RequestManager.instance.defaultInstance;
    }

    constructor(
        @inject(CoreTypes.LogProvider) readonly logProvider: ILogProvider | undefined,
        @inject(CoreTypes.MetricsProvider) readonly metrics: IMetricsProvider | undefined,
    ) {
        if (!logProvider) {
            console.warn("No log provider injected!");
        } else {
            this.logger = logProvider.l.child({label: "Requests"});
        }
        if (!metrics) {
            console.warn("No metrics provider injected!");
        }

        const interfaces = networkInterfaces();
        i: for (let id in interfaces) {
            const iface = interfaces[id];
            a: for (let address of iface) {
                if (!isPublicNetworkInterface(address)) {
                    continue i; // skip interface
                }

                (this.logger || console).info(`${ address.family } ${ address.address } ${ address.netmask } ${ address.mac } ${ address.cidr }`);
                RequestManager.IPS.add(address.address);
            }
        }

        this.setupInstance(GENERIC, {});
        this.setupQueue(GENERIC, Time.millis(100), 1);
    }

    /**@deprecated**/
    static registerInstance<K extends RequestKey>(config: RequestConfig<K>) {
        return RequestManager.instance.registerInstance(config);
    }

    registerInstance<K extends RequestKey>(config: RequestConfig<K>) {
        const key = this.mapKey(config.key);
        if (this.instances.has(key)) {
            (this.logger || console).warn(`Instance with key ${ key } already exists!`);
            return;
        }
        if (this.queues.has(key)) {
            (this.logger || console).warn(`Queue with key ${ key } already exists!`);
            return;
        }

        if (config?.ip?.bind) {
            const bind = config.ip.bind;
            if (!RequestManager.IPS.has(bind)) {
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
            (this.logger || console).info(`Setting up proxy for ${ key } via ${ config.proxy.host }`);
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

    protected mapKey(key: RequestKey): string {
        if (typeof key === "string") {
            return key;
        }
        return JSON.stringify(key);
    }

    /**@deprecated**/
    protected static createAxiosInstance(config: CreateAxiosDefaults) {
        return RequestManager.instance.createAxiosInstance(config);
    }

    protected createAxiosInstance(config: CreateAxiosDefaults): AxiosInstance {
        const instance = axios.create(config);
        instance.defaults.headers["User-Agent"] = "MineSkin";
        instance.defaults.headers["Content-Type"] = "application/json";
        instance.defaults.headers["Accept"] = "application/json";
        instance.defaults.timeout = TIMEOUT;
        instance.interceptors.response.use((response) => response, (error) => {
            const is429 = error.response?.status === 429;
            Sentry.captureException(error, {
                level: is429 ? 'fatal' : 'error',
                extra: {
                    responseCode: error.response?.status,
                    endpoint: error.config?.url
                }
            });
            (this.logger || console).error(`Error in Axios API, status ${ error.response?.status } ${ is429 ? "(429)" : "" }`);
            (this.logger || console).error(error.config?.url);
            (this.logger || console).error(JSON.stringify(error.response?.data, null, 2));
            (this.logger || console).error(JSON.stringify(error.response?.headers, null, 2));
            (this.logger || console).error(JSON.stringify(error.request?.data, null, 2));
            throw error;
        });
        return instance;
    }

    /**@deprecated**/
    protected static setupInstance(key: string, config: AxiosRequestConfig, constr: AxiosConstructor = (c) => RequestManager.createAxiosInstance(c)) {
        return RequestManager.instance.setupInstance(key, config, constr);
    }

    protected setupInstance(key: string, config: AxiosRequestConfig, constr: AxiosConstructor = (c) => this.createAxiosInstance(c)) {
        this.instances.set(key, constr(config));
        (this.logger || console).info("set up axios instance " + key);
    }

    /**@deprecated**/
    protected static setupQueue(key: string, interval: number, maxPerRun: number): void {
        return RequestManager.instance.setupQueue(key, interval, maxPerRun);
    }

    protected setupQueue(key: string, interval: number, maxPerRun: number): void {
        this.queues.set(key, new JobQueue<AxiosRequestConfig, AxiosResponse>(request => {
            return this.runAxiosRequest(request, key);
        }, interval, maxPerRun));
        (this.logger || console).info("set up request queue " + key);
    }

    /**@deprecated**/
    protected static async runAxiosRequest(request: AxiosRequestConfig, inst: AxiosInstance | string = RequestManager.axiosInstance): Promise<AxiosResponse> {
        return RequestManager.instance.runAxiosRequest(request, inst);
    }

    protected async runAxiosRequest(request: AxiosRequestConfig, inst: AxiosInstance | string = this.defaultInstance): Promise<AxiosResponse> {
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

        const start = Date.now();

        let breadcrumb = request.headers?.["X-MineSkin-Breadcrumb"] || "00000000";
        (this.logger || console).debug(`${ breadcrumb } ==> ${ request.method || 'GET' } ${ request.url } via ${ instanceKey }`);

        const response = await instance.request(request);
        const end = Date.now();

        (this.logger || console).debug(`${ breadcrumb } <== ${ request.method || 'GET' } ${ request.url } (${ response.status }) in ${ end - start }ms`);

        return response;
    }

    /**@deprecated**/
    public static async dynamicRequest<K extends RequestKey>(key: K, request: AxiosRequestConfig, breadcrumb?: Breadcrumb): Promise<AxiosResponse> {
        return RequestManager.instance.dynamicRequest(key, request, breadcrumb);
    }

    public async dynamicRequest<K extends RequestKey>(key: K, request: AxiosRequestConfig, breadcrumb?: Breadcrumb): Promise<AxiosResponse> {
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
            (this.logger || console).warn(`${ breadcrumb } Rejecting new request as queue for ${ k } is full (${ q.size })! `);
            throw new Error("Request queue is full!");
        }

        (this.logger || console).debug(`${ breadcrumb } ... ${ request.method || 'GET' } ${ request.url }`);

        return await q.add(request);
    }

}

type AxiosConstructor = (config: AxiosRequestConfig) => AxiosInstance;
