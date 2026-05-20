/**
 * @file helpers.ts
 * @description Centralized utility functions and shared metadata for thermal comfort models.
 *
 * This file serves as the single source of truth for:
 * 1. Comfort zone definitions (labels, colors, and thresholds) for all models (PMV, UTCI, Heat Index, etc.).
 * 2. Mathematical utilities (rounding, finite checks).
 * 3. UI helpers (axis range padding, result formatting, input ordering).
 */

import {
  inputOrder,
  type InputId as InputIdType,
} from "../../models/inputSlots";
import { FieldKey } from "../../models/fieldKeys";
import { fieldMetaByKey } from "../../models/inputFieldsMeta";
import type {
  CompareInputMap,
} from "../../models/comfortDtos";
import type { ComfortZoneResponseDto } from "../../comfortModels/pmv";
import type { UtciResponseDto } from "../../comfortModels/utci";
import { UnitSystem, type UnitSystem as UnitSystemType } from "../../models/units";
import { convertFieldValueFromSi } from "../units";
import { ThermalZone } from "../../models/thermalZone";

export type ComfortZonesByInput = Partial<Record<InputIdType, ComfortZoneResponseDto>>;
export type UtciChartResultsByInput = Partial<Record<InputIdType, UtciResponseDto>>;

/**
 * Dynamically constructs Plotly colorscales based on a zones list.
 * @param zones The list of thermal zones.
 * @returns A Plotly-compatible colorscale array.
 */
export function buildColorscale(zones: ThermalZone[]) {
  const colorscale: Array<[number, string]> = [];
  const step = 1 / zones.length;
  zones.forEach((zone, i) => {
    colorscale.push([i * step, zone.color]);
    colorscale.push([(i + 1) * step, zone.color]);
  });
  return colorscale;
}

/**
 * Rounds a number to a specific number of decimal places.
 * @param value The number to round.
 * @param decimals The number of decimal places (default is 3).
 * @returns The rounded number.
 */
export function roundValue(value: number, decimals = 3): number {
  return Number(value.toFixed(decimals));
}

/**
 * Checks if a value is a finite number.
 * @param value The value to check.
 * @returns True if the value is a number and is finite.
 */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Asserts that a value is finite, throwing an error for non-finite values such as NaN and Infinity.
 * @param label The label for the value (used in error messages).
 * @param value The number to check.
 * @returns The value if finite.
 */
export function ensureFiniteValue(label: string, value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} calculation returned an invalid value.`);
  }

  return value;
}

/**
 * Formats a temperature value for display, including a sign prefix and unit.
 * @param value The temperature in SI.
 * @param unitSystem The active unit system.
 * @returns A formatted string (e.g., "+25.0 °C").
 */
export function formatSignedTemperature(value: number, unitSystem: UnitSystemType = UnitSystem.SI): string {
  const convertedValue = convertFieldValueFromSi(FieldKey.DryBulbTemperature, value, unitSystem);
  const rounded = roundValue(convertedValue, 1);
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)} ${fieldMetaByKey[FieldKey.DryBulbTemperature].displayUnits[unitSystem]}`;
}

/**
 * Calculates a padded axis range for charts based on a set of values.
 * @param values The data points to cover.
 * @param fallback The default range if no values are provided.
 * @param padding The amount of padding to add to the edges.
 * @returns Buffer-padded [min, max] range.
 */
export function getPaddedAxisRange(
  values: number[],
  fallback: [number, number],
  padding = 4,
): [number, number] {
  if (values.length === 0) {
    return fallback;
  }

  const rawMin = values.reduce((min, current) => Math.min(min, current));
  const rawMax = values.reduce((max, current) => Math.max(max, current));

  const roundedMin = Math.floor((rawMin - padding) / 5) * 5;
  const roundedMax = Math.ceil((rawMax + padding) / 5) * 5;

  const paddedMinimum = Math.max(fallback[0], roundedMin);
  const paddedMaximum = Math.min(fallback[1], roundedMax);

  if (paddedMinimum === paddedMaximum) {
    return [
      Math.max(fallback[0], paddedMinimum - 5),
      Math.min(fallback[1], paddedMaximum + 5),
    ];
  }

  return [paddedMinimum, paddedMaximum];
}

/**
 * Helper function to get ordered inputs from a map of inputs.
 * @param inputsByInput The map of inputs keyed by InputIdType.
 * @returns An array of inputs in the correct order.
 */
export function getCompareInputs<T>(inputsByInput: CompareInputMap<T>): Array<{ inputId: InputIdType; payload: T }> {
  return inputOrder
    .filter((inputId) => !!inputsByInput[inputId])
    .map((inputId) => ({
      inputId,
      payload: inputsByInput[inputId] as T,
    }));
}

