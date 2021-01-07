import { AxiosInstance } from "axios";
import { Auth } from "../auth";
import { AXIOS_TOKEN } from "../constants";
import { Inject } from "../di/inject";
import { Injectable } from "../di/injectable";
import { ApiResponse } from "../types";

type Params = { [key: string]: string | number }


@Injectable()
export class RequestBuilder {
    constructor(
        @Inject(AXIOS_TOKEN) private axios: AxiosInstance,
        private auth: Auth,
    ) { }

    private _section: string;
    private _method: string;
    private _params: Params = {};

    public section(value: string): RequestBuilder {
        this._section = value;
        return this;
    }

    public method(value: string): RequestBuilder {
        this._method = value;
        return this;
    }

    public params(value: Params): RequestBuilder {
        this._params = { ...this.params, ...value };
        return this;
    }

    public send<T>(timeout?: number): Promise<ApiResponse<T>> {

        const url = 'https://api.vk.com/method';

        const requestUrl = `${url}/${this._section}.${this._method}`;

        const baseParams = {
            access_token: this.auth.token,
            v: 5.101
        };

        const params = {
            ...baseParams,
            ...this._params
        };

        return timeout ? new Promise<ApiResponse<T>>(resolve =>
            setTimeout(() =>
                this.axios.get<ApiResponse<T>>(requestUrl, { params })
                    .then(res => res.data)
                    .then(resolve),
                timeout
            )) :
            this.axios.get<ApiResponse<T>>(requestUrl, { params })
                .then(res => res.data);
    }

}


