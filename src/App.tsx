import { framer, CanvasNode } from "framer-plugin";
import { useState, useEffect } from "react";
import "./App.css";

async function getAllLinks(node: CanvasNode): Promise<string[]> {
  const links: string[] = [];
  //console.log(node);

  // Verificar si el nodo tiene un enlace
  if (node.link) {
    links.push(node.link);
  }

  // Verificar si los controles del nodo tienen un enlace
  if (node.controls?.link) {
    links.push(node.controls.link);
  }

  // Si el nodo es una instancia de componente, trabajar con sus controles
  if (node.__class === "ComponentInstanceNode") {
    console.log(`Nodo de componente detectado: ${node.name}`);
    // Verifica los controles o propiedades adicionales
    if (node.controls) {
      for (const key in node.controls) {
        const value = node.controls[key];
        if (typeof value === "string" && value.startsWith("/")) {
          links.push(value);
        }
      }
    }
    // No se puede continuar con los hijos directamente, salir
    return links;
  }

  // Obtener y recorrer los hijos del nodo
  const children = await node.getChildren();
  for (const child of children) {
    // Llamada recursiva para procesar cada hijo y sus descendientes
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
async function validateLink(
  url: string
): Promise<{ url: string; status: number; valid: boolean }> {
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
  console.log(textStyles);

  for (const node of selection) {
    console.log(node);

    const nodeStyleId = await node.getChildren();

    for (const child of nodeStyleId) {
      const matchingStyle = textStyles.find((style) => style.id === child.id);

      if (!matchingStyle) {
        errors.push(`Element ${node.id} does not match any text style.`);
      } else {
        const nodeAttributes = await node.getAttributes();
        const styleAttributes = matchingStyle.getAttributes();

        for (const key in styleAttributes) {
          if (nodeAttributes[key] !== styleAttributes[key]) {
            errors.push(
              `Element ${node.id} has a mismatch in ${key}. Expected: ${styleAttributes[key]}, Found: ${nodeAttributes[key]}`
            );
          }
        }
      }
    }
  }

  return errors;
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

async function checkWidths(selection: CanvasNode[]): Promise<string[]> {
  const errors: string[] = [];

  for (const node of selection) {
    const nodeAttributes = await node.getNodesWithType("FrameNode");

    // Asegurarse de que es un FrameNode
    for (const nodeSelect of nodeAttributes) {
      const width = nodeSelect.width;
      const maxWidth = nodeSelect.maxWidth;

      // Validar ancho FILL (asumiendo que "1fr" equivale a "FILL")
      if (nodeSelect.name != "Desktop") {
        if (width !== "1fr" && width !== "fit-content") {
          errors.push(
            `El nodo "${nodeSelect.name}" (${nodeSelect.id}) no tiene ancho configurado como "FILL".`
          );
          console.log(nodeSelect);
          nodeSelect.setAttributes({
            backgroundColor: "#FFE4E4",
          });
        }

        // Validar maxWidth (asumiendo que un valor numérico es válido)
        if (!maxWidth || maxWidth === null) {
          console.log(nodeSelect);

          errors.push(
            `El nodo "${nodeSelect.name}" (${nodeSelect.id}) no tiene un MAX-WIDTH válido.`
          );
        }
      }
    }
  }

  return errors;
}

// Función para aplicar vínculos tel: y mailto:
async function applyTelMailto(node: CanvasNode) {
  const phoneRegex =
    /(\+?\d{1,4}[\s-]?)?(\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{4}/g;
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

  let text = node.name;
  let controlsText = node.controls ? node.controls.title : "";
  console.log(controlsText);

  // Verifica si el nodo actual es de tipo "Text"
  if (
    text.toUpperCase() === "EMAIL" ||
    text.toUpperCase() === "PHONE" ||
    controlsText.toUpperCase() === "EMAIL" ||
    controlsText.toUpperCase() === "PHONE"
  ) {
    let textContent = node.link || node.controls.link;

    // Detecta y aplica enlaces "tel:" para teléfonos
    textContent = textContent.replace(phoneRegex, (match) => {
      console.log(`Se aplicaron vínculos en el nodo: "${node.name}"`);
      return `<a href="tel:${match.replace(/\s+/g, "")}">${match}</a>`;
    });

    // Detecta y aplica enlaces "mailto:" para correos electrónicos
    textContent = textContent.replace(emailRegex, (match) => {
      console.log(`Se aplicaron vínculos en el nodo: "${node.name}"`);
      return `<a href="mailto:${match}">${match}</a>`;
    });

    // Actualiza el texto del nodo si se hicieron cambios
    // if (textContent !== node.text) {
    //   node.text = textContent;
    // }
  }

  // Recursión: procesa todos los hijos del nodo
  const children = await node.getChildren();
  for (const child of children) {
    await applyTelMailto(child); // Llamada recursiva para los hijos
  }
}

// Componente principal del plugin
export function App() {
  const selection = useSelection();
  const [results, setResults] = useState<
    { url: string; status: number; valid: boolean }[]
  >([]);
  const [links, setLinks] = useState<string[]>([]);
  const [styleErrors, setStyleErrors] = useState<string[]>([]);
  const [widthErrors, setWidthErrors] = useState<string[]>([]);
  const [telMailtoErrors, setTelMailtoErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

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
    const widthErrors = await checkWidths(selection);
    setWidthErrors(widthErrors);
    setLoading(false);
  };

  const handleCheckTelMailto = async () => {
    setLoading(true);
    for (const node of selection) {
      await applyTelMailto(node);
    }
    setLoading(false);
    console.log("Se han aplicado los vínculos tel: y mailto: en la selección.");
  };

  return (
    <main>
      <p>You have {selection.length} layers selected.</p>

      {links.length > 0 && (
        <p>{links.length} links found in selected layer/s</p>
      )}

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
        onClick={handleCheckWidths}
        disabled={loading}
      >
        {loading ? "Checking widths..." : "Check Widths"}
      </button>

      <button
        className="framer-button-secondary"
        onClick={handleCheckTelMailto}
        disabled={loading}
      >
        {loading ? "Checking Tel & Mailto..." : "Check Tel & Mailto"}
      </button>
      {loading && <p>Checking... Please wait. 🔄</p>}

      {!loading && results.length > 0 && (
        <div>
          <h4>Link Validation Results</h4>
          {results.map((result, index) => (
            <p key={index}>
              {result.url}: {result.valid ? "✅ Valid" : "❌ Invalid"}
            </p>
          ))}
        </div>
      )}

      {!loading && styleErrors.length > 0 && (
        <div>
          <h4>Style Errors</h4>
          <ul>
            {styleErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {!loading && widthErrors.length > 0 && (
        <div>
          <h4>Width Errors</h4>
          <ul>
            {widthErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {!loading && telMailtoErrors.length > 0 && (
        <div>
          <h4>Tel & Mailto Errors</h4>
          <ul>
            {telMailtoErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {!loading &&
        styleErrors.length === 0 &&
        results.length === 0 &&
        widthErrors.length === 0 && <p>No issues found! 🎉</p>}
    </main>
  );
}
