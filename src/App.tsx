import { framer, CanvasNode } from "framer-plugin";
import { useState, useEffect } from "react";
import "./App.css";

async function getAllLinks(node: CanvasNode): Promise<string[]> {
    const links: string[] = [];
  
    // Check node links
    if (node.link) {
      links.push(node.link);
    }
  
    // Check controls
    if (node.controls?.link) {
      links.push(node.controls.link);
    }
  
    // Handle ComponentInstanceNode specifically
    if (node.__class === "ComponentInstanceNode") {
      if (node.controls) {
        for (const key in node.controls) {
          const value = node.controls[key];
          if (typeof value === "string" && (value.startsWith("/") || value.startsWith("tel:") || value.startsWith("mailto:"))) {
            links.push(value);
          }
        }
      }
      return links; // Skip deeper children for components
    }
  
    // Process children recursively
    const children = await node.getChildren();
    for (const child of children) {
      links.push(...(await getAllLinks(child)));
    }
  
    return links;
  }

/**
 * Función para obtener todos los enlaces de la selección actual
 */
async function getLinksFromSelection(
  selection: CanvasNode[]
): Promise<string[]> {
  const allLinks: string[] = [];

  for (const node of selection) {
    allLinks.push(...(await getAllLinks(node)));
  }

  return allLinks;
}

// Función para validar los enlaces (internos y externos)
// Función para validar los enlaces (internos y externos)
async function validateLink(url: string): Promise<{ url: string; status: number; valid: boolean }> {
    // Check if the link starts with 'mailto:' and treat it as a special case
    if (url.startsWith("mailto:")) {
      const email = url.substring(7); // Remove 'mailto:' from the beginning
      
      // Basic email structure validation (checking for '@' and a dot)
      if (!email.includes('@') || !email.includes('.')) {
        return { url, status: 0, valid: false }; // Invalid email format
      }
      
      return { url, status: 0, valid: true }; // Valid mailto link
    }
  
    // If it's a plain email (no mailto:) but it looks like an email
    if (url.includes('@') && url.includes('.')) {
      return { 
        url, 
        status: 0, 
        valid: false,
        message: 'Email link should start with "mailto:"',
      }; // Should not be a valid email link without 'mailto:'
    }
  
    // Check if the link starts with 'tel:' and treat it as a special case
    if (url.startsWith("tel:")) {
      const phoneNumber = url.substring(4); // Remove 'tel:' from the beginning
      // Allow phone numbers with area code (including '+') or simple numbers
      if (!/^\+?\d[\d\s]*$/.test(phoneNumber)) {
        return { url, status: 0, valid: false }; // Invalid phone number format
      }
      return { url, status: 0, valid: true }; // Valid tel link
    }

    // If it's a plain phone number (without tel:), it is invalid
    if (/^\+?\d+$/.test(url)) {
        return {
            url,
            status: 0,
            valid: false,
            message: 'Phone number link should start with "tel:"',
        };
    }

    // If it's a plain email (no mailto:) but it looks like an email
    if (url.includes('+') && url.includes('.')) {
        return { url, status: 0, valid: false }; // Should not be a valid email link without 'mailto:'
    }
  
    // Handle regular URL links (check if it's a valid URL)
    try {
      const response = await fetch(url, {
        mode: "no-cors",
        method: "HEAD",
        headers: {
          "Content-Type": "application/json",
        },
      }); // Use HEAD to minimize data transfer
      return { url, status: response.status, valid: true };
    } catch (err) {
      console.log(`Error validating link ${url}:`, err);
      return { url, status: 0, valid: false };
    }
}

async function checkStyles(selection: CanvasNode[]): Promise<string[]> {
    const errors: string[] = [];
    const textStyles = await framer.getTextStyles();
    const colorStyles = await framer.getColorStyles();
    
    // Categorized error storage
    const textStyleErrors: string[] = [];
    const colorStyleErrors: string[] = [];
    
    // Check for missing text styles
    textStyles.forEach((style) => {
      if (!style.name) {
        textStyleErrors.push(`Text style with tag ${style.tag} is missing a name.`);
      }
      if (!style.font) {
        textStyleErrors.push(`Text style with tag ${style.tag} is missing a font.`);
      }
      if (!style.color) {
        textStyleErrors.push(`Text style with tag ${style.tag} is missing a color.`);
      }
      if (style.fontSize === '0px') {
        textStyleErrors.push(`Text style with tag ${style.tag} has an invalid font size of 0px.`);
      }
    });
    
    // Check for missing color styles
    colorStyles.forEach((style) => {
      if (!style.name) {
        colorStyleErrors.push(`Color style "${style.name}" is missing a name.`);
      }
      if (!style.light) {
        colorStyleErrors.push(`Color style with "${style.name}" is missing a light color value.`);
      }
      if (!style.dark) {
        colorStyleErrors.push(`Color style with "${style.name}" is missing a dark color value.`);
      }
    });
    
    // Example of checking selection nodes (CanvasNode) for style application errors
    selection.forEach((node) => {
      if ('text' in node && (node as any).text?.style && !textStyles.find((style) => style.id === (node as any).text.style)) {
        errors.push(`Node with ID ${node.id} is using a non-existent text style.`);
      }
      if ('color' in node && (node as any).color && !colorStyles.find((style) => style.id === (node as any).color)) {
        errors.push(`Node with ID ${node.id} is using a non-existent color style.`);
      }
    });
    
    // Combine errors into a categorized format
    const categorizedErrors = [];
    
    if (textStyleErrors.length > 0) {
    //   categorizedErrors.push('🔠 Text Style Errors');
      categorizedErrors.push(...textStyleErrors);
    }
    
    if (colorStyleErrors.length > 0) {
    //   categorizedErrors.push('🌈 Color Style Errors');
      categorizedErrors.push(...colorStyleErrors);
    }
    
    // Output the errors for review
    console.log(categorizedErrors);

    return categorizedErrors;
  }

// Mostrar la UI del plugin en la parte superior derecha
framer.showUI({
  position: "top right",
  width: 420,
  height: 295,
});

// Hook para suscribirse a la selección de nodos en el lienzo
function useSelection() {
  const [selection, setSelection] = useState<CanvasNode[]>([]);

  useEffect(() => {
    // Suscribirse a la selección de nodos
    const unsubscribe = framer.subscribeToSelection(setSelection);
    return unsubscribe; // Limpiar la suscripción cuando el componente se desmonte
  }, []);

  return selection;
}

async function checkNodeNames(selection: CanvasNode[]): Promise<string[]> {
    const errors: string[] = [];
    const genericNames = ["Stack", "Frame", "Rectangle", "Group", "Component"]; // Add other defaults if necessary
  
    // Recursive function to process nodes and their children
    async function processNode(node: CanvasNode) {
      if (genericNames.includes(node.name)) {
        errors.push(
          `Node "${node.name}" (ID: ${node.id}) has a generic name. Consider renaming it to something more descriptive.`
        );
  
        // Highlight the node for visibility
        node.setAttributes({
          backgroundColor: "#FFD700", // Gold color for highlighting
        });
      }
  
      // Process child nodes
      const children = await node.getChildren();
      for (const child of children) {
        await processNode(child);
      }
    }
  
    // Check all selected nodes
    for (const node of selection) {
      await processNode(node);
    }
  
    return errors;
  }

async function checkWidths(selection: CanvasNode[]) {
    const errors = {
      inconsistencies: new Set<string>(), // Nodes with mixed REL and FILL
      noMaxWidth: new Set<string>(), // Nodes missing maxWidth
      invalidWidths: new Set<string>(), // Nodes with invalid widths
    };
  
    const widthTypes: Map<string, CanvasNode[]> = new Map(); // Track nodes by width type
  
    for (const node of selection) {
      const frameNodes = await node.getNodesWithType("FrameNode");
  
      for (const frameNode of frameNodes) {
        const width = frameNode.width;
        const maxWidth = frameNode.maxWidth;
  
        if (frameNode.name !== "Desktop") {
          // Categorize invalid widths
          if (width !== "1fr" && width !== "fit-content") {
            errors.invalidWidths.add(`"${frameNode.name}" (ID: ${frameNode.id})`);
            frameNode.setAttributes({ backgroundColor: "#FFCCCC" });
          } else {
            // Track consistent width types
            if (!widthTypes.has(width)) widthTypes.set(width, []);
            widthTypes.get(width)?.push(frameNode);
          }
  
          // Categorize nodes missing maxWidth
          if (!maxWidth) {
            errors.noMaxWidth.add(`"${frameNode.name}" (ID: ${frameNode.id})`);
            frameNode.setAttributes({ backgroundColor: "#FFE4E4" });
          }
        }
      }
    }
  
    // Check for width inconsistencies
    if (widthTypes.size > 1) {
      errors.inconsistencies.add(
        "Detected mixed REL (1fr) and FILL (fit-content) widths in the template."
      );
      for (const [widthType, nodes] of widthTypes.entries()) {
        for (const node of nodes) {
          errors.inconsistencies.add(`"${('name' in node ? node.name : node.id)}" (ID: ${node.id})`);
        //   node.setAttributes({ backgroundColor: "#FFD700" }); //paint with gold
        }
      }
    }
  
    return {
      inconsistencies: Array.from(errors.inconsistencies),
      noMaxWidth: Array.from(errors.noMaxWidth),
      invalidWidths: Array.from(errors.invalidWidths),
    };
  }

// Componente principal del plugin
export function App() {
  const selection = useSelection();
  const [results, setResults] = useState<
    { url: string; status: number; valid: boolean }[]
  >([]);
  const [links, setLinks] = useState<string[]>([]);
  const [styleErrors, setStyleErrors] = useState<string[]>([]);
  const [namingErrors, setNamingErrors] = useState<string[]>([]);
  const [widthErrors, setWidthErrors] = useState<{
    inconsistencies: string[];
    noMaxWidth: string[];
    invalidWidths: string[];
  }>({
    inconsistencies: [],
    noMaxWidth: [],
    invalidWidths: [],
  });
  const [loading, setLoading] = useState(false);

  const handleClear = () => {
    setResults([]);
    setLinks([]);
    setStyleErrors([]);
    setWidthErrors({
      inconsistencies: [],
      noMaxWidth: [],
      invalidWidths: []
    });
    setNamingErrors([]);
  };

  const handleCheckNodeNames = async () => {
    setLoading(true);
    const errors = await checkNodeNames(selection);
    setNamingErrors(errors);
    setLoading(false);
  };

  const handleValidateLinks = async () => {
    setLoading(true);
    const foundLinks = await getLinksFromSelection(selection);
    setLinks(foundLinks);

    const validations = await Promise.all(foundLinks.map(validateLink));

    setResults(validations);
    setLoading(false);
  };

  const handleCheckStyles = async () => {
    setLoading(true);
    const errors = await checkStyles(selection);
    setStyleErrors(errors);
    setLoading(false);
  };

  const handleCheckWidths = async () => {
    setLoading(true);
    const errors = await checkWidths(selection);
    setWidthErrors(errors);
    setLoading(false);
  };

  return (
    <main>
      <p>You have {selection.length} layers selected.</p>

      {links.length > 0 && (
        <p>{links.length} links found in selected layer/s</p>
      )}

    <button
    className="framer-button-secondary"
    onClick={handleClear}
    disabled={loading}
    >
    Clear Results
    </button>

      <button
        className="framer-button-primary"
        onClick={handleValidateLinks}
        disabled={loading}
      >
        {loading ? "Validating..." : "Validate Links"}
      </button>

      <button
        className="framer-button-secondary"
        onClick={handleCheckStyles}
        disabled={loading}
      >
        {loading ? "Checking styles..." : "Check Styles"}
      </button>

      <button
        className="framer-button-secondary"
        onClick={handleCheckNodeNames}
        disabled={loading}
        >
        {loading ? "Checking names..." : "Check Node Names"}
        </button>

      <button
        className="framer-button-secondary"
        onClick={handleCheckWidths}
        disabled={loading}
      >
        {loading ? "Checking widths..." : "Check Widths"}
      </button>
      {loading && <p>Checking... Please wait. 🔄</p>}

      {!loading && results.length > 0 && (
        <div>
            <h4>Link Validation Results</h4>
            {results.map((result, index) => (
            <p key={index}>
                {result.url}: {result.valid ? "✅" : "❌"} {result.message}
            </p>
            ))}
        </div>
        )}

        {!loading && namingErrors.length > 0 && (
        <div>
            <h2>Naming Errors</h2> 
            <h3>🟡 Highlighted elements in yellow have a generic name, consider changing these.</h3>
            {/* <ul>
            {namingErrors.map((error, index) => (
                <li key={index}>{error}</li>
            ))}
            </ul> */}
            <h4>CMD + Z to revert to original colors after analyzing.</h4>
        </div>
        )}

        {!loading && styleErrors.length > 0 && (
        <div>
            <h4>Style Errors</h4>
            <div>
            {styleErrors.map((error, index) => {
                // Check for categories
                if (error.startsWith('🌙')) {
                return <h5 key={index}>{error}</h5>;
                } else {
                return <ul key={index}><li>{error}</li></ul>;
                }
            })}
            </div>
        </div>
        )}

    {!loading &&
    (widthErrors.inconsistencies.length > 0 ||
        widthErrors.noMaxWidth.length > 0 ||
        widthErrors.invalidWidths.length > 0) && (
        <div>
        <h4>Width Errors</h4>
        <h3>🔴 Highlighted elements in red have an inconsistent width.</h3>

        {/* Inconsistencies
        {widthErrors.inconsistencies.length > 0 && (
            <div>
            <h3>⚠️ Inconsistencies</h3>
            <ul>
                {widthErrors.inconsistencies.map((error, index) => (
                <li key={index}>{error}</li>
                ))}
            </ul>
            </div>
        )} */}

        {/* No Max Width
        {widthErrors.noMaxWidth.length > 0 && (
            <div>
            <h3>🚫 Missing Max-Width</h3>
            <ul>
                {widthErrors.noMaxWidth.map((error, index) => (
                <li key={index}>{error}</li>
                ))}
            </ul>
            </div>
        )} */}

        {/* Invalid Widths */}
        {widthErrors.invalidWidths.length > 0 && (
            <div>
                <ul>
                    {widthErrors.invalidWidths.map((error, index) => (
                    <li key={index}>{error}</li>
                    ))}
                </ul>
            </div>
        )}

        <h4>CMD + Z to revert to original colors after you finished analyzing</h4>
        </div>
    )}

      {!loading &&
        styleErrors.length === 0 &&
        results.length === 0 &&
        widthErrors.length === 0 && <p>No issues found! 🎉</p>}
    </main>
  );
}
