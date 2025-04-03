declare global {
  interface Window {
    Module: {
      PropsSI: (
        property: string,
        property1: string,
        value1: number,
        property2: string,
        value2: number,
        fluid: string
      ) => number;
      get_global_param_string: (parameter: string) => string;
    };
  }
}

export {};
