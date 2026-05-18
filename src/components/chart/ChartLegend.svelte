<script lang="ts">
  /**
   * @component
   * ChartLegend.svelte
   *
   * Renders the thermal comfort zone legends for various charts.
   * Dynamically displays color-coded categories for PMV, UTCI, Adaptive, and other thermal models.
   */
  import {
    ChartId,
    type ChartId as ChartIdType,
  } from "../../models/chartOptions";
  import type { ComfortModel as ComfortModelType } from "../../models/comfortModels";
  import { ComfortModel } from "../../models/comfortModels";
  import {
    adaptiveAshraeZones,
    adaptiveEnZones,
    pmvZones,
    utciStressBands,
  } from "../../services/comfort/helpers";
  import { heatIndexZonesList } from "../../comfortModels/heatIndex";
  import { humidexZonesList } from "../../comfortModels/humidex";
  import { windChillZonesList } from "../../comfortModels/windChill";

  type LegendZone = {
    readonly label: string;
    readonly color: string;
  };

  interface Props {
    selectedChart: ChartIdType;
    selectedModel: ComfortModelType;
  }

  let {
    selectedChart,
    selectedModel,
  }: Props = $props();

  const utciZones = utciStressBands.map((band) => ({
    label: band.label,
    color: band.color,
  }));

  const isPmvChart = $derived(
    selectedChart === ChartId.Psychrometric ||
      selectedChart === ChartId.PmvDynamic,
  );

  const isUtciChart = $derived(
    selectedChart === ChartId.Stress || selectedChart === ChartId.UtciDynamic,
  );
</script>

{#snippet legendSection(title: string, zones: ReadonlyArray<LegendZone>)}
  <div
    class="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-stone-100 pt-4"
  >
    <span class="text-xs font-semibold uppercase tracking-wider text-stone-400"
      >{title}</span
    >
    <div class="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
      {#each zones as zone}
        <div class="flex items-center gap-1.5">
          <div
            class="h-2.5 w-2.5 rounded-full border border-stone-200 shadow-sm"
            style="background-color: {zone.color}"
          ></div>
          <span class="text-[11px] font-medium text-stone-500"
            >{zone.label}</span
          >
        </div>
      {/each}
    </div>
  </div>
{/snippet}

{#if isPmvChart}
  {@render legendSection("PMV Zones", pmvZones)}
{/if}

{#if isUtciChart}
  {@render legendSection("UTCI Zones", utciZones)}
{/if}

{#if selectedChart === ChartId.HeatIndexRanges || selectedChart === ChartId.HeatIndexDynamic}
  {@render legendSection("Heat Index", heatIndexZonesList)}
{/if}

{#if selectedChart === ChartId.Humidex || selectedChart === ChartId.HumidexDynamic}
  {@render legendSection("Humidex", humidexZonesList)}
{/if}

{#if selectedChart === ChartId.WindChillDynamic}
  {@render legendSection("Wind Chill", windChillZonesList)}
{/if}

{#if selectedChart === ChartId.Adaptive || selectedChart === ChartId.AdaptiveDynamic}
  {@render legendSection(
    "Adaptive Zones",
    selectedModel === ComfortModel.AdaptiveAshrae ? adaptiveAshraeZones : adaptiveEnZones,
  )}
{/if}
