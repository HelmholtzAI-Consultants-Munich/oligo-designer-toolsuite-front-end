import type React from "react";

type LegalMarkdownBlock =
    | { type: "heading"; level: number; text: string }
    | { type: "paragraph"; text: string }
    | { type: "list"; items: string[] };

const flushParagraph = (
    blocks: LegalMarkdownBlock[],
    paragraphLines: string[]
): string[] => {
    if (paragraphLines.length > 0) {
        blocks.push({
            type: "paragraph",
            text: paragraphLines.join(" "),
        });
    }
    return [];
};

const flushList = (
    blocks: LegalMarkdownBlock[],
    listItems: string[]
): string[] => {
    if (listItems.length > 0) {
        blocks.push({
            type: "list",
            items: [...listItems],
        });
    }
    return [];
};

const parseLegalMarkdown = (body: string): LegalMarkdownBlock[] => {
    const blocks: LegalMarkdownBlock[] = [];
    let paragraphLines: string[] = [];
    let listItems: string[] = [];

    body.split("\n").forEach((rawLine) => {
        const line = rawLine.trim();

        if (!line) {
            paragraphLines = flushParagraph(blocks, paragraphLines);
            listItems = flushList(blocks, listItems);
            return;
        }

        const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
            paragraphLines = flushParagraph(blocks, paragraphLines);
            listItems = flushList(blocks, listItems);
            blocks.push({
                type: "heading",
                level: Math.min(headingMatch[1].length, 6),
                text: headingMatch[2].trim(),
            });
            return;
        }

        if (line.startsWith("- ")) {
            paragraphLines = flushParagraph(blocks, paragraphLines);
            listItems.push(line.slice(2).trim());
            return;
        }

        listItems = flushList(blocks, listItems);
        paragraphLines.push(line);
    });

    flushParagraph(blocks, paragraphLines);
    flushList(blocks, listItems);

    return blocks;
};

interface LegalMarkdownProps {
    body: string;
    documentKey: string;
}

const LegalMarkdown: React.FC<LegalMarkdownProps> = ({ body, documentKey }) => {
    const blocks = parseLegalMarkdown(body);

    return (
        <>
            {blocks.map((block, index) => {
                const key = `${documentKey}-${index}`;

                if (block.type === "heading") {
                    switch (block.level) {
                        case 1:
                            return <h1 key={key}>{block.text}</h1>;
                        case 2:
                            return <h2 key={key}>{block.text}</h2>;
                        case 3:
                            return <h3 key={key}>{block.text}</h3>;
                        case 4:
                            return <h4 key={key}>{block.text}</h4>;
                        case 5:
                            return <h5 key={key}>{block.text}</h5>;
                        default:
                            return <h6 key={key}>{block.text}</h6>;
                    }
                }

                if (block.type === "list") {
                    return (
                        <ul key={key}>
                            {block.items.map((item, itemIndex) => (
                                <li key={`${key}-${itemIndex}`}>{item}</li>
                            ))}
                        </ul>
                    );
                }

                return <p key={key}>{block.text}</p>;
            })}
        </>
    );
};

export default LegalMarkdown;
