import { EmbindModule } from "@luisbedoia/coolprop-wasm";

// CoolProp Plot API Types
interface ParameterRange {
  min: number;
  max: number;
}

interface PlotAxisDefinition {
  parameter: number;
  scale: 0 | 1; // 0 = linear, 1 = log
  range: ParameterRange;
}

interface IsolineOption {
  parameter: number;
  range: ParameterRange;
}

interface PlotDefinition {
  id: string;
  label: string;
  xAxis: PlotAxisDefinition;
  yAxis: PlotAxisDefinition;
  isolineOptions: IsolineOption[];
}

interface FluidPlotCatalogue {
  fluid: string;
  plots: PlotDefinition[];
}

interface IsolineRequest {
  parameter: number;
  values?: number[];
  valueCount?: number;
  points?: number;
  useCustomRange?: boolean;
  customRange?: ParameterRange;
}

interface PlotRequest {
  fluid: string;
  plotId: string;
  isolines: IsolineRequest[];
  includeSaturationCurves?: boolean;
  defaultPointsPerIsoline?: number;
}

interface GeneratedIsoline {
  parameter: number;
  value: number;
  x: number[];
  y: number[];
}

interface PlotData {
  fluid: string;
  plotId: string;
  xAxis: PlotAxisDefinition;
  yAxis: PlotAxisDefinition;
  isolines: GeneratedIsoline[];
  availableIsolines: IsolineOption[];
  generatedIsolines: Array<{
    parameter: number;
    range: ParameterRange;
    count: number;
  }>;
}

interface CoolPropExtendedModule extends EmbindModule {
  describeFluidPlots: (fluid: string) => FluidPlotCatalogue;
  buildPropertyPlot: (request: PlotRequest) => PlotData;
  get_parameter_information: (
    parameterKey: string | number,
    info: "IO" | "short" | "units" | "long",
  ) => string;
}

declare global {
  interface Window {
    CP: CoolPropExtendedModule;
  }
}

export {};
