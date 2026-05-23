<script lang="ts">
  /**
   * @component
   * ResultsPanel.svelte
   *
   * Renders a tabular display of thermal comfort model results for all visible inputs.
   * It dynamically groups results by category (e.g., "Heat Index", "UTCI") and applies
   * color-coded tones based on the comfort risk levels calculated by the models.
   */
  import {
    Card,
    Table,
    TableBody,
    TableBodyCell,
    TableBodyRow,
    TableHead,
    TableHeadCell,
  } from "flowbite-svelte";
  import { inputDisplayMetaById } from "../models/inputSlotPresentation";
  import type { InputId as InputIdType } from "../models/inputSlots";
  import type { ResultSectionViewModel } from "../state/comfortTool/types";

  interface Props {
    activeInputId: InputIdType;
    visibleInputIds: InputIdType[];
    resultSections: ResultSectionViewModel[];
    errorMessage: string;
    isLoading: boolean;
    embedded?: boolean;
  }

  let {
    activeInputId,
    visibleInputIds,
    resultSections,
    errorMessage,
    isLoading,
    embedded = false,
  }: Props = $props();
</script>

{#snippet table(sections: ResultSectionViewModel[])}
  <Table>
    <TableHead>
      <TableHeadCell>Input</TableHeadCell>
      {#each sections as section}
        <TableHeadCell>{section.title}</TableHeadCell>
      {/each}
    </TableHead>
    <TableBody>
      {#each visibleInputIds as inputId}
        <TableBodyRow>
          <TableBodyCell
            class={`font-medium ${inputDisplayMetaById[inputId].accentClass}`}
          >
            {inputDisplayMetaById[inputId].label}
          </TableBodyCell>
          {#each sections as section}
            {@const cell = section.valuesByInput[inputId]}
            <!-- Render the cell, applying direct inline color from the thermal comfort zone if provided -->
            <TableBodyCell
              class={!cell ? "text-stone-400" : ""}
              style={cell?.color ? `color: ${cell.color}` : ""}
            >
              {#if cell}
                <div class="font-medium">{cell.text}</div>
                {#if cell.subtext}
                  <div class="text-[10px] opacity-70 mt-0.5">
                    {cell.subtext}
                  </div>
                {/if}
              {:else}
                <!-- Display loading state when results are being fetched -->
                {isLoading ? "Loading..." : "No result"}
              {/if}
            </TableBodyCell>
          {/each}
        </TableBodyRow>
      {/each}
    </TableBody>
  </Table>
{/snippet}

{#snippet content()}
  {@const groups = Array.from(
    new Set(resultSections.map((s) => s.group ?? "default")),
  )}

  <div class="flex flex-col gap-6">
    {#each groups as group}
      {@const sectionsInGroup = resultSections.filter(
        (s) => (s.group ?? "default") === group,
      )}
      <div class="flex flex-col gap-2">
        {#if group !== "default"}
          <h3
            class="text-[11px] font-bold uppercase tracking-widest text-stone-400 px-1"
          >
            {group}
          </h3>
        {/if}
        {@render table(sectionsInGroup)}
      </div>
    {/each}
  </div>
{/snippet}

{#if embedded}
  {@render content()}
{:else}
  <Card size="none" class="p-3">
    {@render content()}
  </Card>
{/if}
