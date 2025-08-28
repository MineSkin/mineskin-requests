import { AxiosRequestConfig } from "axios";
export interface MineSkinAxiosRequestConfig<T = unknown> extends AxiosRequestConfig<T> {
    meta?: {
        breadcrumb?: string;
        timing?: Record<string, number>;
    };
}
