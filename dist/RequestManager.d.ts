import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { rateLimitOptions } from "axios-rate-limit";
import { RequestConfig, RequestKey } from "./RequestConfig";
export declare const GENERIC = "generic";
export declare class RequestManager {
    static readonly axiosInstance: AxiosInstance;
    protected static readonly defaultRateLimit: rateLimitOptions;
    private static instances;
    private static queues;
    static init(): void;
    static registerInstance<K extends RequestKey>(config: RequestConfig<K>): void;
    private static mapKey;
    protected static setupInstance(key: string, config: AxiosRequestConfig, constr?: AxiosConstructor): void;
    private static setupQueue;
    protected static runAxiosRequest(request: AxiosRequestConfig, inst?: AxiosInstance | string): Promise<AxiosResponse>;
    static dynamicRequest<K extends RequestKey>(key: K, request: AxiosRequestConfig): Promise<AxiosResponse>;
}
type AxiosConstructor = (config: AxiosRequestConfig) => AxiosInstance;
export {};
