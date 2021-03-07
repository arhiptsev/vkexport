import 'reflect-metadata';

export const Inject = (token: any) => (target: any, key: string | Symbol, index: number) => {
  const deps = Reflect.getMetadata('design:paramtypes', target);
  deps[index] = token;
  Reflect.defineMetadata('design:paramtypes', deps, target);
};


