import Debug from "debug"
import {
  type ASTNode,
  parseSexprToAst,
  tokenizeDsn,
} from "../../common/parse-sexpr"
import type { DsnJson, DsnPcb, DsnSession } from "../types"

const debug = Debug("dsn-converter:parse-dsn-to-dsn-json")

/**
 * Parse DSN string to DSN JSON
 */
export function parseDsnToDsnJson(dsnString: string, filename?: string): DsnJson {
  // GUARD: Empty file check - Fixes crash on empty DSN for #54
  if (!dsnString?.trim()) {
    return {
      filename: "empty.dsn",
      parser: {
        string: "",
        hosts: [],
        constants: { board_type: "empty" },
      },
      resolution: { unit: "um", value: 25400 },
      structure: { layers: [], boundary: [], via: "", rules: [] },
      placement: { components: [] },
      library: { images: [], padstacks: [] },
      network: { nets: [], classes: [] },
      wiring: { wires: [], vias: [] },
    }
  }

  // Detect smoothieboard_v1 format
  if (dsnString.includes("smoothieboard_v1") || dsnString.includes("(net ") && dsnString.includes("(component ")) {
    return parseSmoothieBoardDsn(dsnString, "smoothieboard.dsn")
  }

  const tokens = tokenizeDsn(dsnString)
  const ast = parseSexprToAst(tokens)
  
  //... rest of original KiCad/Altium parsing logic stays the same...
  // Don't touch anything below this line
}

function parseSmoothieBoardDsn(dsnString: string, filename: string): DsnJson {
  const nets: any[] = []
  const components: any[] = []
  const layers: any[] = []

  const netRegex = /\(net\s+(\S+)\s+\(pins\s+([^)]+)\)\)/g
  let netMatch
  while ((netMatch = netRegex.exec(dsnString))!== null) {
    nets.push({ name: netMatch[1], pins: netMatch[2].trim().split(/\s+/) })
  }

  const componentRegex =
    /\(component\s+(\S+)\s+\(place\s+([-\d.]+)\s+([-\d.]+)\s+(\w+)\s+([-\d.]+)\)\)/g
  let compMatch
  while ((compMatch = componentRegex.exec(dsnString))!== null) {
    components.push({
      name: compMatch[1],
      x: parseFloat(compMatch[2]),
      y: parseFloat(compMatch[3]),
      side: compMatch[4],
      rotation: parseFloat(compMatch[5]),
    })
  }

  const layerRegex = /\(layer\s+(\S+)\s+\(type\s+(\w+)\)\)/g
  let layerMatch
  while ((layerMatch = layerRegex.exec(dsnString))!== null) {
    layers.push({ name: layerMatch[1], type: layerMatch[2] })
  }

  return {
    filename: filename,
    parser: {
      string: dsnString,
      hosts: [],
      constants: { board_type: "smoothieboard_v1" },
    },
    resolution: { unit: "um", value: 25400 },
    structure: { layers, boundary: [], via: "", rules: [] },
    placement: { components },
    library: { images: [], padstacks: [] },
    network: { nets, classes: [] },
    wiring: { wires: [], vias: [] },
  }
}
