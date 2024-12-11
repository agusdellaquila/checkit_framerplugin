import { framer, CanvasNode } from "framer-plugin"
import { useState, useEffect } from "react"
import "./App.css"

async function getAllLinks(node: CanvasNode): Promise<string[]> {
    const links: string[] = []
    if (node.link) {
        links.push(node.link)
    }

    // Si el nodo tiene hijos, revisamos cada uno recursivamente
    const children = await node.getChildren()
    for (const child of children) {
        links.push(...await getAllLinks(child))
    }

    return links
}

/**
 * Función para obtener todos los enlaces de la selección actual
 */
async function getLinksFromSelection(selection: CanvasNode[]): Promise<string[]> {
    const allLinks: string[] = []

    for (const node of selection) {
        allLinks.push(...await getAllLinks(node))
    }

    return allLinks
}

// Función para validar los enlaces (internos y externos)
async function validateLink(url: string): Promise<{ url: string; status: number; valid: boolean }> {
    try {
        const response = await fetch(url, { method: "HEAD" }); // Use HEAD to minimize data transfer
        return { url, status: response.status, valid: response.ok };
    } catch (err) {
        console.log(`Error validating link ${url}:`, err);
        return { url, status: 0, valid: false };
    }
}

async function checkStyles(selection: CanvasNode[]): Promise<string[]> {
    const errors: string[] = []
    const textStyles = await framer.getTextStyles()

    for (const node of selection) {
        const nodeStyleId = await node.getTextStyleId()
        const matchingStyle = textStyles.find(style => style.id === nodeStyleId)

        if (!matchingStyle) {
            errors.push(`Element ${node.id} does not match any text style.`)
        } else {
            const nodeAttributes = await node.getAttributes()
            const styleAttributes = matchingStyle.getAttributes()

            for (const key in styleAttributes) {
                if (nodeAttributes[key] !== styleAttributes[key]) {
                    errors.push(
                        `Element ${node.id} has a mismatch in ${key}. Expected: ${styleAttributes[key]}, Found: ${nodeAttributes[key]}`
                    )
                }
            }
        }
    }

    return errors
}

// Mostrar la UI del plugin en la parte superior derecha
framer.showUI({
    position: "top right",
    width: 220,
    height: 195,
})

// Hook para suscribirse a la selección de nodos en el lienzo
function useSelection() {
    const [selection, setSelection] = useState<CanvasNode[]>([])

    useEffect(() => {
        // Suscribirse a la selección de nodos
        const unsubscribe = framer.subscribeToSelection(setSelection)
        return unsubscribe // Limpiar la suscripción cuando el componente se desmonte
    }, [])

    return selection
}


// Componente principal del plugin
export function App() {
    const selection = useSelection()
    const [results, setResults] = useState<{ url: string; status: number; valid: boolean }[]>([])
    const [links, setLinks] = useState<string[]>([])
    const [styleErrors, setStyleErrors] = useState<string[]>([])
    const [loading, setLoading] = useState(false)

    const handleValidateLinks = async () => {
        setLoading(true)
        const foundLinks = await getLinksFromSelection(selection)
        setLinks(foundLinks)

        const validations = await Promise.all(foundLinks.map(validateLink))
        setResults(validations)
        setLoading(false)
    }

    const handleCheckStyles = async () => {
        setLoading(true)
        const errors = await checkStyles(selection)
        setStyleErrors(errors)
        setLoading(false)
    }

    return (
        <main>
            <p>
                You have {selection.length} layers selected.
            </p>

            {links.length > 0 && (
                <p>
                    {links.length} links found in selected layer/s
                </p>
            )}

            <button className="framer-button-primary" onClick={handleValidateLinks} disabled={loading}>
                {loading ? "Validating..." : "Validate Links"}
            </button>

            <button className="framer-button-secondary" onClick={handleCheckStyles} disabled={loading}>
                {loading ? "Checking styles..." : "Check Styles"}
            </button>

            {loading && <p>Loading... Please wait. 🔄</p>}

            {!loading && results.length > 0 && (
                <div>
                    <h4>Link Validation Results</h4>
                    {results.map((result, index) => (
                        <p key={index}>{result.url}: {result.valid ? "✅ Valid" : "❌ Invalid"}</p>
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

            {!loading && styleErrors.length === 0 && results.length === 0 && (
                <p>No issues found! 🎉</p>
            )}
        </main>
    )
}