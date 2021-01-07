import { Provider } from "./types";
import { isFunction } from '../utils/type-guards';

export class Injector {

    private dependencies = new Map<any, Omit<Provider, 'token'>>();

    constructor() {
        this.dependencies.set(Injector, {
            value: this
        });
    }

    public provideDependencies = (providers: Array<Provider | Function>) => {
        providers.forEach(provider => {

            if (isFunction(provider)) {
                this.dependencies.set(provider, {
                    value: null,
                    singleton: true
                });
            } else {
                const { token, value, singleton } = provider
                this.dependencies.set(token, {
                    value: value === undefined ? null : value,
                    singleton: singleton !== undefined ? singleton : true
                });
            }
        });
    }

    public getDependency<T = any>(target: any): T {
        const dep = this.dependencies.get(target);

        if (dep.value) {
            return dep.value;
        }

        const dependency = this.getDependencyInstance(target);

        if (dep.singleton) {
            dep.value = dependency;
        }

        return dependency;

    }

    private getDependencyInstance(target) {
        const deps = this.getDependencies(target);
        const depInstances = deps.map(d => this.getDependency(d));
        return new target(...depInstances);
    }

    private getDependencies(constructor: any) {

        return Reflect.getMetadata('design:paramtypes', constructor) || [];
    }



}