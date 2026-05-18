/**
 * Shared Chart Construction Logic
 * 
 * Contains common chart building functions that are reused across different 
 * comfort models. Provides standardized visualizations for shared parameters (e.g. comfort zones and input points).
 */
import { inputChartStyleById, inputDisplayMetaById } from "../../../models/inputSlotPresentation";
import { FieldKey } from "../../../models/fieldKeys";
import { fieldMetaByKey } from "../../../models/inputFieldsMeta";
import { CalculationSource } from "../../../models/calculationMetadata";
import type { ComfortPointDto, CompareInputMap, PlotlyChartResponseDto, PlotTraceDto, PlotAnnotationDto } from "../../../models/comfortDtos";
import { UnitSystem, type UnitSystem as UnitSystemType } from "../../../models/units";
import { convertFieldValueFromSi, convertFieldValueToSi } from "../../units";
import { getCompareInputs, roundValue, buildColorscale, type ComfortZonesByInput } from "../helpers";
import { buildComfortPolygonTrace, buildInputAnnotation, buildInputScatterTrace, buildContourTrace } from "./plotlyBuilders";
import { buildComfortZonePolygon } from "./pmvCharts";
import { ThermalZone } from "../../../models/thermalZone";
import type { InputId as InputIdType } from "../../../models/inputSlots";

/**
 * Builds the Relative Humidity chart.
 * @param payload - The comfort inputs.
 * @param comfortZonesByInput - The comfort zones.
 * @param unitSystem - The unit system.
 * @returns The comfort chart response DTO.
 */
export function buildRelativeHumidityChart(
  payload: { inputs: CompareInputMap<ComfortPointDto> },
  comfortZonesByInput: ComfortZonesByInput = {},
  unitSystem: UnitSystemType = UnitSystem.SI,
): PlotlyChartResponseDto {
  const inputs = getCompareInputs(payload.inputs);
  const showInputLegend = inputs.length > 1;
  const traces: PlotTraceDto[] = [];
  const annotations: PlotAnnotationDto[] = [];
  const temperatureDisplayUnits = fieldMetaByKey[FieldKey.DryBulbTemperature].displayUnits[unitSystem];

  // Add traces for each input.
  inputs.forEach(({ inputId, payload: inputPayload }) => {
    // Get the input meta data.
    const inputMeta = inputDisplayMetaById[inputId];
    // Get the comfort zone.
    const comfortZone = comfortZonesByInput[inputId];
    // Build the comfort zone polygon.
    const { polygonX, polygonY } = buildComfortZonePolygon(
      /*
        The polygon is built using the cool and warm edges of the comfort zone.
        The edges are arrays of comfort points.
        The points are converted to the display units using the convertFieldValueFromSi function.
      */
      comfortZone?.coolEdge || [],
      comfortZone?.warmEdge || [],
      (point) => roundValue(convertFieldValueFromSi(FieldKey.DryBulbTemperature, point.tdb, unitSystem)),
      (point) => roundValue(point.rh),
    );

    if (polygonX.length > 0) {
      // Add the comfort zone polygon trace.
      traces.push(buildComfortPolygonTrace({
        inputId,
        nameSuffix: "RH comfort zone",
        polygonX,
        polygonY,
        hovertemplate: `Tdb %{x:.1f} ${temperatureDisplayUnits}<br>RH %{y:.0f}%<extra></extra>`,
        isComfortZone: true,
      }));
    }
    // Add the input scatter trace.
    traces.push(buildInputScatterTrace({
      inputId,
      x: roundValue(convertFieldValueFromSi(FieldKey.DryBulbTemperature, inputPayload.tdb, unitSystem)),
      y: roundValue(inputPayload.rh),
      showLegend: showInputLegend,
      hovertemplate: `${inputMeta.label}<br>Tdb %{x:.1f} ${temperatureDisplayUnits}<br>RH %{y:.0f}%<extra></extra>`,
    }));
  });

  // Return the comfort chart response DTO.
  return {
    traces,
    layout: {
      title: "Relative humidity chart",
      paper_bgcolor: "#ffffff",
      plot_bgcolor: "#f8fafc",
      showlegend: showInputLegend,
      margin: { l: 56, r: 24, t: 48, b: 56 },
      xaxis: {
        title: `Dry bulb temperature (${temperatureDisplayUnits})`,
        range: [
          convertFieldValueFromSi(FieldKey.DryBulbTemperature, 10, unitSystem),
          convertFieldValueFromSi(FieldKey.DryBulbTemperature, 40, unitSystem),
        ],
        gridcolor: "#e2e8f0",
      },
      yaxis: {
        title: "Relative humidity (%)",
        range: [0, 100],
        gridcolor: "#e2e8f0",
      },
      legend: { orientation: "h", x: 0, y: 1.1 },
      height: 480,
    },
    annotations,
    source: CalculationSource.FrontendGenerated,
  };
}

/**
 * Builds a generic range chart for thermal indices, creating a 2D contour chart 
 * of the index over a specified range of two input variables.
 * 
 * @param payload - The inputs for the chart, including multiple calculation inputs.
 * @param cachedResultsByInput - A map of input IDs to their cached calculation results.
 * @param unitSystem - The unit system (SI or IP) for unit conversions.
 * @param config - Configuration object defining the chart's properties.
 * @returns PlotlyChartResponseDto - The chart data containing traces and layout.
 */
function buildStaticContourChart(
  inputsMap: CompareInputMap<Record<string, any>>,
  cachedResultsByInput: any,
  unitSystem: UnitSystemType,
  config: {
    title: string;
    xKey: FieldKey;
    yKey: FieldKey;
    xRangeSi: { min: number; max: number };
    yRangeSi: { min: number; max: number };
    zMax: number;
    colorscale: any[][];
    hovertemplateContour: string;
    getHovertemplateScatter: (inputLabel: string, cached: any) => string;
    getScatterXSi: (payload: any) => number;
    getScatterYSi: (payload: any) => number;
    calculatePoint: (xSi: number, ySi: number) => { rangeValue: number; category: string };
  }
): PlotlyChartResponseDto {
  const inputs = getCompareInputs(inputsMap);
  const showInputLegend = inputs.length > 1;

  const xMeta = fieldMetaByKey[config.xKey];
  const yMeta = fieldMetaByKey[config.yKey];

  const xMin = convertFieldValueFromSi(config.xKey, config.xRangeSi.min, unitSystem);
  const xMax = convertFieldValueFromSi(config.xKey, config.xRangeSi.max, unitSystem);
  const yMin = convertFieldValueFromSi(config.yKey, config.yRangeSi.min, unitSystem);
  const yMax = convertFieldValueFromSi(config.yKey, config.yRangeSi.max, unitSystem);

  const xPoints = 300;
  const yPoints = 300;
  const xValues: number[] = [];
  const yValues: number[] = [];

  for (let i = 0; i < xPoints; i++) xValues.push(xMin + i * ((xMax - xMin) / (xPoints - 1)));
  for (let i = 0; i < yPoints; i++) yValues.push(yMin + i * ((yMax - yMin) / (yPoints - 1)));

  const zValues: number[][] = [];
  const textValues: string[][] = [];

  for (let i = 0; i < yPoints; i++) {
    const row: number[] = [];
    const textRow: string[] = [];
    const ySi = convertFieldValueToSi(config.yKey, yValues[i], unitSystem);

    for (let j = 0; j < xPoints; j++) {
      const xSi = convertFieldValueToSi(config.xKey, xValues[j], unitSystem);
      try {
        const { rangeValue, category } = config.calculatePoint(xSi, ySi);
        row.push(rangeValue);
        textRow.push(category);
      } catch {
        row.push(NaN);
        textRow.push("Error");
      }
    }
    zValues.push(row);
    textValues.push(textRow);
  }

  const traces: PlotTraceDto[] = [
    buildContourTrace({
      name: config.title,
      x: xValues,
      y: yValues,
      z: zValues,
      text: textValues,
      colorscale: config.colorscale,
      zmin: 0,
      zmax: config.zMax,
      contours: {
        coloring: "fill",
        showlines: false,
        type: "levels",
        start: 0.5,
        end: config.zMax - 0.5,
        size: 1,
        smoothing: 1.3,
        line: { width: 1, color: "#333333" },
      },
      hovertemplate: config.hovertemplateContour,
      showscale: false,
      isBackgroundZone: true,
    }),
    buildContourTrace({
      name: "Boundaries",
      x: xValues,
      y: yValues,
      z: zValues,
      colorscale: config.colorscale,
      zmin: 0,
      zmax: config.zMax,
      contours: {
        coloring: "none" as const,
        showlines: true,
        type: "levels",
        start: 0.5,
        end: config.zMax - 0.5,
        size: 1,
        smoothing: 1.3,
        line: { width: 1, color: "#333333" },
      },
      hovertemplate: "",
      hoverinfo: "skip",
      showscale: false,
    })
  ];

  inputs.forEach((input) => {
    const cached = cachedResultsByInput[input.inputId];
    const xVal = convertFieldValueFromSi(config.xKey, config.getScatterXSi(input.payload), unitSystem);
    const yVal = convertFieldValueFromSi(config.yKey, config.getScatterYSi(input.payload), unitSystem);
    
    traces.push(
      buildInputScatterTrace({
        inputId: input.inputId,
        x: xVal,
        y: yVal,
        showLegend: showInputLegend,
        hovertemplate: config.getHovertemplateScatter(inputDisplayMetaById[input.inputId].label, cached),
      })
    );
  });

  return {
    traces,
    layout: {
      title: config.title,
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      showlegend: showInputLegend,
      margin: { l: 60, r: 24, t: 60, b: 60 },
      xaxis: { title: `${xMeta.label} (${xMeta.displayUnits[unitSystem]})`, range: [xMin, xMax] },
      yaxis: { title: `${yMeta.label} (${yMeta.displayUnits[unitSystem]})`, range: [yMin, yMax] }
    },
    annotations: [],
    source: CalculationSource.JsThermalComfort
  };
}

/**
 * Builds a generic dynamic 2D contour chart for thermal indices based on user-selected axes.
 */
function buildDynamicContourChart(
  inputsMap: CompareInputMap<Record<string, any>>,
  cachedResultsByInput: any,
  unitSystem: UnitSystemType,
  dynamicXAxis: FieldKey | undefined,
  dynamicYAxis: FieldKey | undefined,
  config: {
    title: string;
    zMax: number;
    colorscale: any[][];
    getRange: (key: FieldKey) => { min: number; max: number };
    calculatePoint: (xSi: number, ySi: number, dynamicXAxis: FieldKey, dynamicYAxis: FieldKey) => { rangeValue: number; category: string };
    getHovertemplateScatter: (inputLabel: string, cached: any) => string;
  }
): PlotlyChartResponseDto {
  const inputs = getCompareInputs(inputsMap);
  const showInputLegend = inputs.length > 1;

  if (!dynamicXAxis || !dynamicYAxis || dynamicXAxis === dynamicYAxis) {
    return {
      traces: [],
      layout: {
        title: "Invalid Axes",
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        showlegend: false,
        margin: { l: 60, r: 24, t: 60, b: 60 },
        xaxis: {},
        yaxis: {},
      },
      annotations: [],
      source: CalculationSource.JsThermalComfort,
    };
  }

  const xMeta = fieldMetaByKey[dynamicXAxis];
  const yMeta = fieldMetaByKey[dynamicYAxis];

  const xRangeSi = config.getRange(dynamicXAxis);
  const yRangeSi = config.getRange(dynamicYAxis);

  const xMin = convertFieldValueFromSi(dynamicXAxis, xRangeSi.min, unitSystem);
  const xMax = convertFieldValueFromSi(dynamicXAxis, xRangeSi.max, unitSystem);
  const yMin = convertFieldValueFromSi(dynamicYAxis, yRangeSi.min, unitSystem);
  const yMax = convertFieldValueFromSi(dynamicYAxis, yRangeSi.max, unitSystem);

  const xPoints = 300;
  const yPoints = 300;
  const xValues: number[] = [];
  const yValues: number[] = [];

  for (let i = 0; i < xPoints; i++) xValues.push(xMin + i * ((xMax - xMin) / (xPoints - 1)));
  for (let i = 0; i < yPoints; i++) yValues.push(yMin + i * ((yMax - yMin) / (yPoints - 1)));

  const zValues: number[][] = [];
  const textValues: string[][] = [];

  for (let i = 0; i < yPoints; i++) {
    const row: number[] = [];
    const textRow: string[] = [];
    const ySi = convertFieldValueToSi(dynamicYAxis, yValues[i], unitSystem);

    for (let j = 0; j < xPoints; j++) {
      const xSi = convertFieldValueToSi(dynamicXAxis, xValues[j], unitSystem);
      try {
        const { rangeValue, category } = config.calculatePoint(xSi, ySi, dynamicXAxis, dynamicYAxis);
        row.push(rangeValue);
        textRow.push(category);
      } catch {
        row.push(NaN);
        textRow.push("Error");
      }
    }
    zValues.push(row);
    textValues.push(textRow);
  }

  const traces: PlotTraceDto[] = [
    buildContourTrace({
      name: config.title,
      x: xValues,
      y: yValues,
      z: zValues,
      text: textValues,
      colorscale: config.colorscale,
      zmin: 0,
      zmax: config.zMax,
      contours: {
        coloring: "fill",
        showlines: false,
        type: "levels",
        start: 0.5,
        end: config.zMax - 0.5,
        size: 1,
        smoothing: 1.3,
        line: { width: 1, color: "#333333" },
      },
      hovertemplate: `${xMeta.label}: %{x:.1f} ${xMeta.displayUnits[unitSystem]}<br>${yMeta.label}: %{y:.1f} ${yMeta.displayUnits[unitSystem]}<br><b>Zone: %{text}</b><extra></extra>`,
      showscale: false,
      isBackgroundZone: true,
    }),
    buildContourTrace({
      name: "Boundaries",
      x: xValues,
      y: yValues,
      z: zValues,
      colorscale: config.colorscale,
      zmin: 0,
      zmax: config.zMax,
      contours: {
        coloring: "none" as const,
        showlines: true,
        type: "levels",
        start: 0.5,
        end: config.zMax - 0.5,
        size: 1,
        smoothing: 1.3,
        line: { width: 1, color: "#333333" },
      },
      hovertemplate: "",
      hoverinfo: "skip",
      showscale: false,
    })
  ];

  inputs.forEach((input) => {
    const getVal = (key: FieldKey) => {
      if (key === FieldKey.RelativeAirSpeed || key === FieldKey.WindSpeed) return input.payload.v || 0;
      return input.payload[key] || 0;
    };

    const xVal = convertFieldValueFromSi(dynamicXAxis, getVal(dynamicXAxis), unitSystem);
    const yVal = convertFieldValueFromSi(dynamicYAxis, getVal(dynamicYAxis), unitSystem);
    const cached = cachedResultsByInput[input.inputId];

    traces.push(
      buildInputScatterTrace({
        inputId: input.inputId,
        x: xVal,
        y: yVal,
        showLegend: showInputLegend,
        hovertemplate: config.getHovertemplateScatter(inputDisplayMetaById[input.inputId].label, cached),
      })
    );
  });

  return {
    traces,
    layout: {
      title: config.title,
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      showlegend: showInputLegend,
      margin: { l: 60, r: 24, t: 60, b: 60 },
      xaxis: { title: `${xMeta.label} (${xMeta.displayUnits[unitSystem]})`, range: [xMin, xMax] },
      yaxis: { title: `${yMeta.label} (${yMeta.displayUnits[unitSystem]})`, range: [yMin, yMax] }
    },
    annotations: [],
    source: CalculationSource.JsThermalComfort
  };
}

/**
 * Model Chart Configuration Interface
 */
export interface ModelChartConfig {
  dynamicChartId: string;
  dynamicTitle: string;
  zones: ThermalZone[];
  customRanges?: Partial<Record<FieldKey, { min: number; max: number }>>;
  baselinePayloadDefault: any;
  calculateDynamicPoint: (xSi: number, ySi: number, dynamicXAxis: FieldKey, dynamicYAxis: FieldKey, baselinePayload: any) => { rangeValue: number; category: string };
  getHovertemplateScatterDynamic: (label: string, cached: any) => string;
  
  // Static ranges chart config (optional)
  staticConfig?: {
    title: string;
    xKey: FieldKey;
    yKey: FieldKey;
    xRangeSi: { min: number; max: number };
    yRangeSi: { min: number; max: number };
    hovertemplateContour: string;
    getHovertemplateScatter: (label: string, cached: any) => string;
    getScatterXSi: (payload: any) => number;
    getScatterYSi: (payload: any) => number;
    calculateStaticPoint: (xSi: number, ySi: number) => { rangeValue: number; category: string };
  };
}

/**
 * A single unified comfort model chart building engine.
 * Selects between dynamic and static range charts and automatically injects common baseline properties.
 */
export function buildComfortModelChart(
  chartId: string,
  chartSource: any,
  resultsByInput: any,
  unitSystem: UnitSystemType,
  config: ModelChartConfig
): PlotlyChartResponseDto | null {
  if (!chartSource) return null;
  const sharedChartRequest = chartSource.chartRequest;

  if (chartId === config.dynamicChartId) {
    return buildDynamicContourChart(
      sharedChartRequest,
      resultsByInput,
      unitSystem,
      chartSource.dynamicXAxis as FieldKey,
      chartSource.dynamicYAxis as FieldKey,
      {
        title: config.dynamicTitle,
        zMax: config.zones.length - 1,
        colorscale: buildColorscale(config.zones),
        getRange: (key: FieldKey) => {
          if (config.customRanges?.[key]) return config.customRanges[key]!;
          const meta = fieldMetaByKey[key];
          return { min: meta.minValue, max: meta.maxValue };
        },
        calculatePoint: (xSi, ySi, dynamicXAxis, dynamicYAxis) => {
          const baselineInputId = chartSource.baselineInputId || (Object.keys(sharedChartRequest)[0] as InputIdType);
          const baselinePayload = sharedChartRequest[baselineInputId] || config.baselinePayloadDefault;
          return config.calculateDynamicPoint(xSi, ySi, dynamicXAxis, dynamicYAxis, baselinePayload);
        },
        getHovertemplateScatter: config.getHovertemplateScatterDynamic,
      }
    );
  }

  if (config.staticConfig) {
    return buildStaticContourChart(sharedChartRequest, resultsByInput, unitSystem, {
      title: config.staticConfig.title,
      xKey: config.staticConfig.xKey,
      yKey: config.staticConfig.yKey,
      xRangeSi: config.staticConfig.xRangeSi,
      yRangeSi: config.staticConfig.yRangeSi,
      zMax: config.zones.length - 1,
      colorscale: buildColorscale(config.zones),
      hovertemplateContour: config.staticConfig.hovertemplateContour,
      getHovertemplateScatter: config.staticConfig.getHovertemplateScatter,
      getScatterXSi: config.staticConfig.getScatterXSi,
      getScatterYSi: config.staticConfig.getScatterYSi,
      calculatePoint: config.staticConfig.calculateStaticPoint,
    });
  }

  return null;
}
