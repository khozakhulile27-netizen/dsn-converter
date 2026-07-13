import Debug from "debug"
import { getPinNum } from "lib/utils/get-pin-number"
import { getViaCoords } from "lib/utils/get-via-coordinates"
import {
  type ASTNode,
  parseSexprToAst,
  tokenizeDsn,
} from "../../common/parse-sexpr"
import type {
  Boundary,
  CircleShape,
  Circuit,
  Class,
  Clearance,
  Component,
  ComponentPlacement,
  DsnJson,
  DsnPcb,
  DsnSession,
  Image,
  Layer,
  Library,
  Net,
  Network,
  Outline,
  Padstack,
  Parser as ParserType,
  Path,
  PathShape,
  Pin,
  Placement,
  Places,
  PolygonShape,
  RectShape,
  Resolution,
  Rule,
  Shape,
  Structure,
  Wire,
  Wiring,
} from "../types"

const debug = Debug("dsn-converter:parse-dsn-to-dsn-json")

// **Process AST into TypeScript Interfaces**
export function parseDsnToDsnJson(dsnString: string, filename?: string): DsnJson {
  // 1. Guard against empty input
  if (!dsnString?.trim()) {
    throw new Error("Empty DSN string provided");
  }

  const tokens = tokenizeDsn(dsnString);
  const ast = parseSExprToAst(tokens);

  // 2. Safely check for session or pcb file type
  if (ast.type === "List" && ast.children && ast.children[0]?.type === "Atom") {
    const rootNode = ast.children[0].value;
    
    if (rootNode === "session") {
      const session = processSessionNode(ast);
      // Ensure filename is attached safely
      session.filename = filename ?? session.filename ?? "session.dsn";
      return session;
    } else if (rootNode === "pcb") {
      const pcb = processPcbNode(ast) as DsnPcb;
      // Ensure filename is attached safely
      pcb.filename = filename ?? pcb.filename ?? "board.pcb";
      return pcb;
    }
  }
  throw new Error("Invalid DSN file format");
}

// **Helper Functions to Process AST Nodes**
// The following functions map the AST nodes to the defined TypeScript interfaces.

function processPcbNode(node: ASTNode): any {
  if (node.type === "List" && node.children && node.children.length > 0) {
    const [head, ...tail] = node.children;
    if (head && head.type === "Atom" && typeof head.value === "string") {
      switch (head.value) {
        case "session":
          return processSessionNode(node);
        case "pcb":
          return processPCB(tail);
        case "parser":
          return processParser(tail);
        case "resolution":
          return node.children.length > 1 ? processResolution(node.children) : null;
        case "unit":
          return node.children.length > 1 ? node.children[1].value : null;
        case "structure":
          return processStructure(tail);
        case "placement":
          return processPlacement(tail);
        case "library":
          return processLibrary(tail);
        case "network":
          return processNetwork(tail);
        case "wiring":
          return processWiring(tail);
        default:
          return null;
      }
    }
  }
  return null    
}


export function processPCB(nodes: ASTNode[]): DsnPcb {
  const pcb: Partial<DsnPcb> = {
    is_dsn_pcb: true,
    wiring: { wires: [] },
  };

  const filenameNode = nodes[0];
  if (filenameNode && filenameNode.type === "Atom" && typeof filenameNode.value === "string") {
    pcb.filename = filenameNode.value;
  } else {
    throw new Error("Expected filename in pcb definition");
  }

  for (let i = 1; i < nodes.length; i++) {
    const element = nodes[i];
    if (element.type === "List" && element.children && element.children.length > 0) {
      const keyNode = element.children[0];
      if (keyNode && keyNode.type === "Atom" && typeof keyNode.value === "string") {
        // Safe access to parser logic
        if (keyNode.value === "parser") {
          pcb.parser = processParser(element.children.slice(1));
        }
      }

                const key = keyNode.value;
        switch (key) {
          case "parser":
            pcb.parser = processParser(element.children.slice(1));
            break;
          case "resolution":
            pcb.resolution = processResolution(element.children);
            break;
          case "unit":
            if (element.children.length > 1 && element.children[1].type === "Atom") {
              pcb.unit = element.children[1].value as string;
            }
            break;
          case "structure":
            pcb.structure = processStructure(element.children.slice(1)) as any;
            break;
          case "placement":
            pcb.placement = processPlacement(element.children.slice(1)) as any;
            break;
          case "library":
            pcb.library = processLibrary(element.children.slice(1));
            break;
          case "network":
            pcb.network = processNetwork(element.children.slice(1)) as any;
            break;
          case "wiring":
            pcb.wiring = processWiring(element.children.slice(1)) as any;
            break;
        }
    }
  return pcb as DsnPcb
}

  
export function processParser(nodes: ASTNode[]): ParserType {
  const parser: Partial<ParserType> = {}
  nodes.forEach((node) => {
    if (node.type === "List" && node.children && node.children.length >= 2) {
      const [keyNode, valueNode] = node.children
      if (
        keyNode?.type === "Atom" &&
        typeof keyNode.value === "string" &&
        valueNode?.type === "Atom" &&
        (typeof valueNode.value === "string" ||
          typeof valueNode.value === "number")
      ) {
        const key = keyNode.value
        const value = valueNode.value
        switch (key) {
          case "string_quote":
            if (typeof value === "string") parser.string_quote = value
            break
          case "space_in_quoted_tokens":
            if (typeof value === "string") parser.space_in_quoted_tokens = value
            break
          case "host_cad":
            if (typeof value === "string") parser.host_cad = value
            break
          case "host_version":
            if (typeof value === "string") parser.host_version = value
            break
        }
      }
    }
  })
  return parser as ParserType

  
export function processResolution(nodes: ASTNode[]): Resolution {
  const [_, unitNode, valueNode] = nodes
  if (
    unitNode.type === "Atom" &&
    typeof unitNode.value === "string" &&
    valueNode.type === "Atom" &&
    typeof valueNode.value === "number"
  ) {
    return {
      unit: unitNode.value,
      value: valueNode.value,
    }
  } else {
    throw new Error("Invalid resolution format")
  }


export function processStructure(nodes: ASTNode[]): Structure {
  const structure: Structure = {
    layers: [],
    boundary: [],
    via: "",
    rules: []
  };

  nodes.forEach((node) => {
    if (node.type === "List" && node.children && node.children.length > 0) {
      const [keyNode, ...rest] = node.children;
      if (keyNode && keyNode.type === "Atom" && typeof keyNode.value === "string") {
        const key = keyNode.value;
        switch (key) {
          case "layer":
            // Safe push
            structure.layers.push(processLayer(node.children));
            break;
          case "boundary":
            structure.boundary = processBoundary(node.children.slice(1));
            break;
          case "via":
            // Safe access
            if (node.children.length > 1 && node.children[1].type === "Atom") {
              structure.via = node.children[1].value as string;
            }
        }
      }
    }
  });
  return structure as Structure;

  
function processLayer(nodes: ASTNode[]): Layer {
  const layer: Partial<Layer> = {}
  if (nodes[1].type === "Atom" && typeof nodes[1].value === "string") {
    layer.name = nodes[1].value as string 
}

  nodes.slice(2).forEach(node => { 
    if (node.type === "List" && node.children) {
    switch (node.children[0]?.value) {
          case "property":
            layer.property = processProperty(node.children.slice(1))
            break
        }
      }
  })
  return layer as Layer
}

  
function processProperty(nodes: ASTNode[]): { index: number } {
  const property: any = {};
  nodes.forEach((node) => {
    if (node.type === "List" && node.children && node.children.length >= 2) {
      const keyNode = node.children[0];
      const valueNode = node.children[1];
      if (
        keyNode.type === "Atom" && typeof keyNode.value === "string" &&
        valueNode.type === "Atom" && typeof valueNode.value === "number"
      ) {
        if (keyNode.value === "index") {
          property.index = valueNode.value;
        }
      }
    }
  });
  return property;
 }

  
function processBoundary(nodes: ASTNode[]): Boundary {
  const boundary: Partial<Boundary> = {}
  nodes.forEach((node) => {
    if (node.type === "List" && node.children![0].type === "Atom") {
      boundary.path = processPath(node.children!)
    }
  })
  // Ensure boundary.path is defined
  if (!boundary.path) {
    boundary.path = { layer: "", width: 0, coordinates: [] }
  }
  return boundary as Boundary
}

  
function processPath(nodes: ASTNode[]): Path {
  // Find the path node which contains layer, width and coordinates
  const pathNode = nodes.find(
    (node) =>
      node.type === "List" &&
      node.children?.[0]?.type === "Atom" &&
      node.children[0].value === "path",
  )

  if (!pathNode) {
    // If no path node found, use the nodes directly
    // This handles the case where nodes is already the path content
    return {
      layer: nodes[1]?.type === "Atom" ? (nodes[1].value as string) : "F.Cu",
      width: nodes[2]?.type === "Atom" ? (nodes[2].value as number) : 200,
      coordinates: nodes
        .slice(3)
        .filter(
          (node) => node.type === "Atom" && typeof node.value === "number",
        )
        .map((node) => node.value as number),
    }
  }

  // Process the path node children
    // Process the path node children
  const pathChildren = pathNode.children ?? [];
  return {
    layer: pathChildren[1]?.type === "Atom" ? (pathChildren[1].value as string) : "F.Cu",
    width: pathChildren[2]?.type === "Atom" ? (pathChildren[2].value as number) : 200,
    coordinates: pathChildren
      .slice(3)
      .filter((node) => node.type === "Atom" && typeof node.value === "number")
      .map((node) => node.value as number),
  };

  
function processRule(nodes: ASTNode[]): Rule {
  const rule: Partial<Rule> = { clearances: [] };

  nodes.forEach((node) => {
    if (node.type === "List" && node.children && node.children.length > 0) {
      const [keyNode, ...rest] = node.children;
      if (keyNode?.type === "Atom" && typeof keyNode.value === "string") {
        switch (keyNode.value) {
          case "width":
            if (rest[0]?.type === "Atom" && typeof rest[0].value === "number") {
              rule.width = rest[0].value;
            }
            break;
          case "clearance":
            rule.clearances.push(processClearance(node.children));
            break;
        }
      }
    }
  });

  return rule as Rule;
}

  
function processClearance(nodes: ASTNode[]): Clearance {
  const clearance: Partial<Clearance> = {};
  if (nodes[1]?.type === "Atom" && typeof nodes[1].value === "number") {
    clearance.value = nodes[1].value;
  }

  for (let i = 2; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type === "List" && node.children && node.children.length >= 2) {
      const [keyNode, valueNode] = node.children;
      if (keyNode?.value === "type" && typeof valueNode?.value === "string") {
        clearance.type = valueNode.value;
      }
    }
  }
  return clearance as Clearance;
}

 
export function processPlacement(nodes: ASTNode[]): Placement {
  const placement: Placement = { components: [] };

  nodes.forEach((node) => {
    if (node.type === "List" && node.children && node.children[0]?.value === "component") {
      placement.components.push(processComponent(node.children));
    }
  });
  return placement;
}

  
function processComponent(nodes: ASTNode[]): ComponentPlacement {
  const component: Partial<ComponentPlacement> = {
    name: nodes[1]?.type === "Atom" ? (nodes[1].value as string) : "",
    places: [],
  };

  nodes.slice(2).forEach((node) => {
    if (node.type === "List" && node.children && node.children[0]?.value === "place") {
      component.places.push(processPlace(node.children));
    }
  });
  return component as ComponentPlacement;
}


function processPlace(nodes: ASTNode[]): Places {
  const places: Partial<Places> = {}

  // Ensure we have at least the basic required nodes
  if (
    nodes.length < 2 ||
    nodes[0].type !== "Atom" ||
    nodes[0].value !== "place"
  ) {
    throw new Error("Invalid place format: missing basic structure")
  }

  // Process refdes (component reference designator)
  if (nodes[1].type === "Atom" && typeof nodes[1].value === "string") {
    places.refdes = nodes[1].value
  } else {
    throw new Error("Invalid place format: invalid refdes")
  }

  // Process coordinates and rotation
  const coordIndex = 2
  if (coordIndex + 3 < nodes.length) {
    if (
      nodes[coordIndex].type === "Atom" &&
      typeof nodes[coordIndex].value === "number" &&
      nodes[coordIndex + 1].type === "Atom" &&
      typeof nodes[coordIndex + 1].value === "number" &&
      nodes[coordIndex + 2].type === "Atom" &&
      typeof nodes[coordIndex + 2].value === "string" &&
      nodes[coordIndex + 3].type === "Atom" &&
      typeof nodes[coordIndex + 3].value === "number"
    ) {
      places.x = nodes[coordIndex].value as number
      places.y = nodes[coordIndex + 1].value as number
      places.side = nodes[coordIndex + 2].value as string
      places.rotation = nodes[coordIndex + 3].value as number
    }
  }

  // Process optional PN (part number) if present
  for (let i = coordIndex + 4; i < nodes.length; i++) {
    const node = nodes[i]
    if (
      node.type === "List" &&
      node.children &&
      node.children[0].type === "Atom" &&
      node.children[0].value === "PN" &&
      node.children[1] &&
      node.children[1].type === "Atom"
    ) {
      places.PN = String(node.children[1].value)
      break
    }
  }

  // Set default values if not present
  places.PN = places.PN || ""
  places.side = places.side || "front"
  places.rotation = places.rotation || 0

  return places as Places
}

export function processLibrary(nodes: ASTNode[]): Library {
  const library: Partial<Library> = {
    images: [],
    padstacks: [],
  }

   nodes.forEach((node) => {
    if (node.type === "List" && node.children && node.children.length > 0) {
      const [keyNode, ...rest] = node.children;
      if (keyNode?.type === "Atom" && typeof keyNode.value === "string") {
        switch (keyNode.value) {
          case "image":
            // Add safe processing for images if needed
            break;
          case "padstack":
            library.padstacks.push(processPadstack(node.children));
            break;
        }
      }
    }
 }); 
  return library as Library


function processImage(nodes: ASTNode[]): Image {
  const image: Partial<Image> = {}
  if (nodes[1].type === "Atom" && typeof nodes[1].value === "string") {
    image.name = nodes[1].value
  }
  image.outlines = []
  image.pins = []

    nodes.slice(2).forEach((node) => {
    if (node.type === "List" && node.children && node.children.length > 0) {
      const [keyNode, ...rest] = node.children;
      if (keyNode?.type === "Atom" && typeof keyNode.value === "string") {
        if (keyNode.value === "outline") {
          image.outlines.push(processOutline(node.children));
        } else if (keyNode.value === "pin") {
          const pin = processPin(node.children);
          if (pin) image.pins.push(pin);
        }
      }
    }
  });

  return image as Image
}

function processOutline(nodes: ASTNode[]): Outline {
  const outline: Partial<Outline> = {}
    nodes.forEach((node) => {
    if (
      node.type === "List" &&
      node.children &&
      node.children[0]?.type === "Atom" &&
      node.children[0]?.value === "path"
    ) {
      outline.path = processPath(node.children);
    }
  });
  
  return outline as Outline
}

  
function processPin(nodes: ASTNode[]): Pin | null {
  const pin: Partial<Pin> = {};
  if (nodes[1]?.type !== "Atom") {
    console.debug("Unsupported pin padstack_name format:", nodes);
    return null;
  }
  pin.padstack_name = String(nodes[1].value);

  // Get pin number safely
  const pinNumber = getPinNum(nodes);
  if (pinNumber === null) return null;
  pin.pin_number = pinNumber;

  // Parse coordinates safely
  let xValue: number | undefined;
  let yValue: number | undefined;

  for (let i = 3; i < nodes.length; i++) {
    const node = nodes[i];
    const nextNode = nodes[i + 1];

    if (node?.type === "Atom" && typeof node.value === "number") {
      if (xValue === undefined) {
        if (nextNode?.type === "Atom" && String(nextNode.value).toLowerCase().startsWith("e")) {
          xValue = Number(`${node.value}${nextNode.value}`);
          i++; // Skip exponent
        } else {
          xValue = node.value;
        }
      } else if (yValue === undefined) {
        if (nextNode?.type === "Atom" && String(nextNode.value).toLowerCase().startsWith("e")) {
          yValue = Number(`${node.value}${nextNode.value}`);
          i++; // Skip exponent
        } else {
          yValue = node.value;
        }
      }
    }
  }

  if (typeof xValue !== "number" || typeof yValue !== "number") {
    throw new Error(`Invalid coordinates: x=${xValue}, y=${yValue}`);
  }
 
    pin.x = xValue;
    pin.y = yValue;
    return pin as Pin;
  }

  function processPadstack(nodes: ASTNode[]): Padstack {
  const padstack: Partial<Padstack> = {};
  if (nodes[1]?.type === "Atom" && typeof nodes[1].value === "string") {
    padstack.name = nodes[1].value;
  }
  padstack.shapes = [];
  padstack.attach = "off";

  nodes.slice(2).forEach((node) => {
    if (node.type === "List" && node.children && node.children.length > 0) {
      const [keyNode, ...rest] = node.children;
      if (keyNode?.type === "Atom" && typeof keyNode.value === "string") {
        if (keyNode.value === "shape") {
          padstack.shapes.push(processShape(node.children));
        } else if (keyNode.value === "attach" && rest[0]?.type === "Atom" && typeof rest[0].value === "string") {
          padstack.attach = rest[0].value;
        } else if (keyNode.value === "hole") {
          if (typeof rest[0]?.value === "number") {
            padstack.hole = { shape: "circle", diameter: rest[0].value };
          } else if (rest[0]?.value === "oval" && rest[1]?.type === "Atom" && rest[2]?.type === "Atom") {
            padstack.hole = { shape: "oval", width: rest[1].value as number, height: rest[2].value as number };
          }
        }
      }
    }
  });
  return padstack as Padstack;
}


function processShape(nodes: ASTNode[]): Shape {
  const shapeContentNode = nodes.find(node => node.type === "List");
  
  if (shapeContentNode?.children && shapeContentNode.children.length > 0) {
    const [shapeTypeNode] = shapeContentNode.children;
    if (shapeTypeNode?.type === "Atom" && typeof shapeTypeNode.value === "string") {
      const shapeType = shapeTypeNode.value;
      const children = shapeContentNode.children;
      
      switch (shapeType) {
        case "polygon": return processPolygonShape(children);
        case "circle": return processCircleShape(children);
        case "rect": return processRectShape(children);
        case "path": return processPathShape(children);
      }
    }
}

  
function processCircleShape(nodes: ASTNode[]): CircleShape {
  const circle: Partial<CircleShape> = { shapeType: "circle" };

  // Safely handle both direct circle nodes and nested shape nodes
  const shapeNodes = (nodes[0]?.value === "shape" && nodes[1]?.children) ? nodes[1].children : nodes;

  if (shapeNodes[1]?.type === "Atom" && typeof shapeNodes[1].value === "string" &&
      shapeNodes[2]?.type === "Atom" && typeof shapeNodes[2].value === "number") {
    circle.layer = shapeNodes[1].value;
    circle.diameter = shapeNodes[2].value;
    return circle as CircleShape;
  } else {
    // Try to extract coordinates if they exist
    const coords = shapeNodes.slice(2).filter((n) => n.type === "Atom" && typeof n.value === "number");
    if (coords.length >= 3 && shapeNodes[1]?.type === "Atom") {
      circle.layer = String(shapeNodes[1].value);
      circle.diameter = Number(coords[1].value);
      return circle as CircleShape;
    throw new Error("Invalid circle shape format");
  }
  
   
export function processNetwork(nodes: ASTNode[]): Network {
  const network: Partial<Network> = {
    nets: [],
    classes: [],
  }

    nodes.forEach((node) => {
    if (node.type === "List" && node.children) {
      const [keyNode, ...rest] = node.children;
      if (keyNode?.type === "Atom" && typeof keyNode.value === "string") {
        const key = keyNode.value;
        if (key === "net") {
          network.nets.push(processNet(node.children));
        } else if (key === "class") {
          network.classes.push(processClass(node.children));
        }
      }
    }
  }); 
  return network as Network

    
function processNet(nodes: ASTNode[]): Net {
  const net: Partial<Net> = {}
  if (nodes[1].type === "Atom" && typeof nodes[1].value === "string") {
    net.name = nodes[1].value
  } else {
    net.name = nodes[1].value?.toString()
    debug("net name was not a string", net.name)
        // Process the pins list
  nodes.slice(2).forEach((node) => {
    if (
      node.type === "List" &&
      node.children &&
      node.children[0]?.type === "Atom" &&
      node.children[0]?.value === "pins"
    ) {
      net.pins = node.children.slice(1).map((pinNode) => {
        if (pinNode.type === "Atom" && typeof pinNode.value === "string") {
          return pinNode.value;
        }
        throw new Error("Invalid pin in net");
      });
    }
  });

  return net as Net
}

function processClass(nodes: ASTNode[]): Class {
  const classObj: Partial<Class> = {}
  if (
    nodes[1].type === "Atom" &&
    typeof nodes[1].value === "string" &&
    nodes[2].type === "Atom" &&
    typeof nodes[2].value === "string"
  ) {
    classObj.name = nodes[1].value
    classObj.description = nodes[2].value
  }

  // The next nodes until 'circuit' are net names
  let i = 3
  classObj.net_names = []
      while (
      i < nodes.length &&
      nodes[i]?.type === "Atom" &&
      typeof nodes[i]?.value === "string"
    ) {
      classObj.net_names?.push(String(nodes[i].value));
      i++;
    }

  // Now process 'circuit' and 'rule'
  while (i < nodes.length) {
    const node = nodes[i]
    if (node.type === "List") {
          if (node.type === "List" && node.children) {
      const [keyNode, ...rest] = node.children;
      if (keyNode?.type === "Atom" && typeof keyNode.value === "string") {
        const key = keyNode.value;
        if (key === "circuit") {
          classObj.circuit = processCircuit(node.children.slice(1));
        } else if (key === "rule") {
          classObj.rule = processRule(node.children.slice(1));
        }
      }
    }
    i++
  }

  return classObj as Class
}

function processCircuit(nodes: ASTNode[]): Circuit {
  const circuit: Partial<Circuit> = {}
    nodes.forEach((node) => {
    if (
      node.type === "List" &&
      node.children &&
      node.children[0]?.type === "Atom" &&
      node.children[0]?.value === "use_via"
    ) {
      if (
        node.children[1]?.type === "Atom" &&
        typeof node.children[1]?.value === "string"
      ) {
        circuit.use_via = node.children[1].value as string;
      }
    }
  });
  return circuit as Circuit
}
  
  
export function processWiring(nodes: ASTNode[]): Wiring {
  const wiring: Partial<Wiring> = {
    wires: [],
  };

  nodes.forEach((node) => {
    if (node.type === "List" && node.children) {
      if (node.children[0]?.type === "Atom" && node.children[0]?.value === "wire") {
        wiring.wires?.push(processWire(node.children));
      } else if (node.children[0]?.type === "Atom" && node.children[0]?.value === "via") {
        const via = processVia(node.children);
        if (via) wiring.wires?.push(via);
      }
    }
  });
  return wiring as Wiring;


export function processVia(nodes: ASTNode[]): Wire | null {
  const coords = getViaCoords(nodes);
  if (!coords) {
    return null;
  }

  const wire: Partial<Wire> = {
    path: {
      layer: "all",
      width: 0,
      coordinates: [coords.x, coords.y],
    },
    type: "via",
  };

  // Find net name if present
  const netNode = nodes.find(
    (node) =>
      node.type === "List" &&
      node.children?.[0]?.type === "Atom" &&
      node.children[0].value === "net"
  );

  if (netNode?.children?.[1]?.type === "Atom") {
    wire.net = String(netNode.children[1].value);
  }
  return wire as Wire;


function processWire(nodes: ASTNode[]): Wire {
  const wire: Partial<Wire> = {}

    nodes.forEach((node) => {
    if (node.type === "List" && node.children) {
      const [keyNode, ...rest] = node.children;
      if (keyNode?.type === "Atom" && typeof keyNode.value === "string") {
        const key = keyNode.value;
        switch (key) {
          case "path":
            wire.path = processPath(node.children);
            break;

          case "polyline_path":
            // Handle polyline path similar to regular path
            if (
              rest.length >= 2 &&
              rest[0].type === "Atom" &&
              typeof rest[0].value === "string" &&
              rest[1].type === "Atom" &&
              typeof rest[1].value === "number"
            ) {
              wire.polyline_path = {
                layer: rest[0].value,
                width: rest[1].value,
                coordinates: rest
                  .slice(2)
                  .filter(
                    (n) => n.type === "Atom" && typeof n.value === "number",
                  )
                  .map((n) => n.value as number),
              }
            }
            break
          case "net":
            if (rest[0].type === "Atom" && typeof rest[0].value === "string") {
              wire.net = rest[0].value
            }
            break
          case "clearance_class":
            if (rest[0].type === "Atom" && typeof rest[0].value === "string") {
              wire.clearance_class = rest[0].value
            }
            break
          case "type":
            if (rest[0].type === "Atom" && typeof rest[0].value === "string") {
              wire.type = rest[0].value
            }
            break
        }
      }
    }
  })

  return wire as Wire
}

function processSessionNode(ast: ASTNode): DsnSession {
  const session: DsnSession = {
    is_dsn_session: true,
    filename: ast.children?.[1]?.type === "Atom"
? (ast.children[1].value as string)
 : "session",
    placement: {
      resolution: { unit: "um", value: 10 },
      components: [],
    },
    routes: {
      resolution: { unit: "um", value: 10 },
      parser: {
        string_quote: "",
        host_version: "",
        space_in_quoted_tokens: "",
        host_cad: "",
      },
      network_out: {
        nets: [],
      },
    },
  }

    // Extract placement section
  const placementNode = ast.children?.find((child) => 
    child.type === "List" && child.children?.[0]?.type === "Atom" && child.children[0].value === "placement"
  );
  if (placementNode?.children) {
    const resolutionNode = placementNode.children.find((child) => 
      child.type === "List" && child.children?.[0]?.type === "Atom" && child.children[0].value === "resolution"
    );
    if (resolutionNode?.children) {
      session.placement.resolution = processResolution(resolutionNode.children);
    }
    session.placement.components = processPlacement(placementNode.children.slice(1)).components;
  }

  // Extract routes section
  const routesNode = ast.children?.find((child) => 
    child.type === "List" && child.children?.[0]?.type === "Atom" && child.children[0].value === "routes"
  );
  if (routesNode?.children) {
    const libraryNode = routesNode.children.find((child) => 
      child.type === "List" && child.children?.[0]?.type === "Atom" && child.children[0].value === "library_out"
    );
    if (libraryNode?.children) {
      session.routes.library_out = {
        images: [],
        padstacks: libraryNode.children
          .filter((child) => child.type === "List" && child.children?.[0]?.type === "Atom" && child.children[0].value === "padstack")
          .map((padstackNode) => processPadstack(padstackNode.children || [])),
      };
    }

    // Extract network_out section
      const networkNode = routesNode.children.find((child) => 
    child.type === "List" && child.children?.[0]?.type === "Atom" && child.children[0].value === "network_out"
  );
      if (networkNode?.children) {
      const netNodes = networkNode.children.filter((child) =>
        child.type === "List" && child.children?.[0]?.type === "Atom" && child.children[0].value === "net"
      );
      session.routes.network_out.nets = netNodes.map((netNode) => {
        const netName = netNode.children?.[1]?.value as string;
        const wireNodes = netNode.children?.filter((child) =>
          child.type === "List" && child.children?.[0]?.type === "Atom" && child.children[0].value === "wire"
        );
        const viaNodes = netNode.children?.filter((child) =>
          child.type === "List" && child.children?.[0]?.type === "Atom" && child.children[0].value === "via"
        );

        const net = {
          name: netName,
          wires: wireNodes.map((wireNode) => ({
            path: processPath(wireNode.children || []),
            net: netName,
            type: "route",
          })),
          vias: viaNodes.map((viaNode) => ({
            x: viaNode.children?.[2]?.value as number,
            y: viaNode.children?.[3]?.value as number,
          })),
        };
        return net;
      });

  return session


function processPathShape(nodes: ASTNode[]): PathShape {
  if (
    nodes[1]?.type === "Atom" &&
    typeof nodes[1].value === "string" &&
    nodes[2]?.type === "Atom" &&
    typeof nodes[2].value === "number"
  ) {
    return {
      shapeType: "path",
      layer: nodes[1].value,
      width: nodes[2].value,
      coordinates: nodes
        .slice(3)
        .filter(
          (node) => node.type === "Atom" && typeof node.value === "number",
        )
        .map((node) => node.value as number),
    }
  }
  throw new Error("Invalid path shape format")
      }
   }
 }
}  
