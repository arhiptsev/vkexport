import { Injectable } from "../di/injectable";
import { Injector } from "../di/injector";
import { RequestBuilder } from "./request_buider";

@Injectable()
export class HttpClient {

  constructor(
    private injector: Injector
  ) { }

  public buildRequest(): RequestBuilder {
    return this.injector.getDependency(RequestBuilder);
  }
}


