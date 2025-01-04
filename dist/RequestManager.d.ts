import { AxiosInstance, AxiosRequestConfig, AxiosResponse, CreateAxiosDefaults } from "axios";
import { rateLimitOptions } from "axios-rate-limit";
import { RequestConfig, RequestKey } from "./RequestConfig";
import { Breadcrumb } from "@mineskin/types";
import { IRequestExecutor } from "@mineskin/core";
import { ILogProvider, IMetricsProvider } from "@mineskin/core";
import winston from "winston";
export declare const GENERIC = "generic";
export declare class RequestManager implements IRequestExecutor {
    readonly logProvider: ILogProvider | undefined;
    readonly metrics: IMetricsProvider | undefined;
    static IPS: Set<string>;
    readonly defaultInstance: AxiosInstance;
    protected static readonly defaultRateLimit: rateLimitOptions;
    private readonly instances;
    private readonly queues;
    private static _instance;
    readonly logger: winston.Logger;
    /**@deprecated**/
    static get instance(): RequestManager;
    /**@deprecated**/
    static init(): void;
    /**@deprecated**/
    static get axiosInstance(): AxiosInstance;
    constructor(logProvider: ILogProvider | undefined, metrics: IMetricsProvider | undefined);
    /**@deprecated**/
    static registerInstance<K extends RequestKey>(config: RequestConfig<K>): void;
    registerInstance<K extends RequestKey>(config: RequestConfig<K>): void;
    protected mapKey(key: RequestKey): string;
    /**@deprecated**/
    protected static createAxiosInstance(config: CreateAxiosDefaults): AxiosInstance;
    protected createAxiosInstance(config: CreateAxiosDefaults): AxiosInstance;
    /**@deprecated**/
    protected static setupInstance(key: string, config: AxiosRequestConfig, constr?: AxiosConstructor): void;
    protected setupInstance(key: string, config: AxiosRequestConfig, constr?: AxiosConstructor): void;
    /**@deprecated**/
    protected static setupQueue(key: string, interval: number, maxPerRun: number): void;
    protected setupQueue(key: string, interval: number, maxPerRun: number): void;
    /**@deprecated**/
    protected static runAxiosRequest(request: AxiosRequestConfig, inst?: AxiosInstance | string): Promise<AxiosResponse>;
    protected runAxiosRequest(request: AxiosRequestConfig, inst?: AxiosInstance | string): Promise<AxiosResponse>;
    /**@deprecated**/
    static dynamicRequest<K extends RequestKey>(key: K, request: AxiosRequestConfig, breadcrumb?: Breadcrumb): Promise<AxiosResponse>;
    dynamicRequest<K extends RequestKey>(key: K, request: AxiosRequestConfig, breadcrumb?: Breadcrumb): Promise<AxiosResponse>;
}
type AxiosConstructor = (config: AxiosRequestConfig) => AxiosInstance;
export {};
